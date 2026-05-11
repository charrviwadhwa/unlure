package com.unlure;

import android.animation.ObjectAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class FocusMonitorService extends Service {
    private static final String CHANNEL_ID = "unlure_privacy_focus";
    private static final int NOTIFICATION_ID = 3101;
    private static final long POLL_MS = 2500L;
    private static final long SCREEN_OFF_POLL_MS = 30000L;
    private static final long EVENT_QUERY_OVERLAP_MS = 500L;
    private static final long LIMITS_CACHE_TTL_MS = 5000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private View overlayView;
    private String overlayPackage;
    private String lastForegroundPackage = "";
    private Runnable pollRunnable;
    private SharedPreferences focusPrefs;
    private Map<String, Integer> cachedLimits = new HashMap<>();
    private long limitsLastLoaded = 0L;
    private final Map<String, Long> todayUsageCache = new HashMap<>();
    private final Map<String, Long> activeStarts = new HashMap<>();
    private final Map<String, Integer> openActivityCounts = new HashMap<>();
    private long lastEventQueryTime = 0L;
    private String usageCacheDate = "";
    private final Set<String> bypassedToday = new HashSet<>();
    private final Set<String> protectedToday = new HashSet<>();
    private String decisionsCacheDate = "";
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || intent.getAction() == null) return;
            if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                handler.removeCallbacks(pollRunnable);
                hideOverlay();
            } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) {
                handler.removeCallbacks(pollRunnable);
                handler.post(pollRunnable);
            }
        }
    };
    private final SharedPreferences.OnSharedPreferenceChangeListener prefListener = (prefs, key) -> {
        if (FocusModePrefs.KEY_LIMITS_JSON.equals(key)) invalidateLimitsCache();
        if (key != null && (key.startsWith(FocusModePrefs.KEY_BYPASS_PREFIX) || key.startsWith(FocusModePrefs.KEY_PROTECTED_PREFIX))) {
            decisionsCacheDate = "";
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        focusPrefs = getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
        focusPrefs.registerOnSharedPreferenceChangeListener(prefListener);
        registerScreenReceiver();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        startPolling();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startPolling();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        try { unregisterReceiver(screenReceiver); } catch (Exception ignored) {}
        if (focusPrefs != null) {
            focusPrefs.unregisterOnSharedPreferenceChangeListener(prefListener);
        }
        hideOverlay();
        super.onDestroy();
    }

    private void startPolling() {
        if (pollRunnable != null) return;
        pollRunnable = () -> {
            checkForegroundApp();
            handler.postDelayed(pollRunnable, getAdaptivePollInterval());
        };
        if (isScreenInteractive()) {
            handler.post(pollRunnable);
        } else {
            handler.postDelayed(pollRunnable, SCREEN_OFF_POLL_MS);
        }
    }

    private void registerScreenReceiver() {
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(screenReceiver, filter);
        }
    }

    private long getAdaptivePollInterval() {
        return isScreenInteractive() ? POLL_MS : SCREEN_OFF_POLL_MS;
    }

    private boolean isScreenInteractive() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                return pm.isInteractive();
            }
            return pm.isScreenOn();
        } catch (Exception ignored) {
            return true;
        }
    }

    private void checkForegroundApp() {
        Map<String, Integer> limits = getLimits();
        if (limits.isEmpty()) {
            stopSelf();
            return;
        }
        resetDailyCachesIfNeeded();

        String foregroundPackage = updateUsageAndForeground(limits.keySet());
        if (foregroundPackage == null || foregroundPackage.isEmpty() || isSystemOrSelfPackage(foregroundPackage)) {
            lastForegroundPackage = "";
            hideOverlay();
            return;
        }

        if (!foregroundPackage.equals(lastForegroundPackage)) {
            lastForegroundPackage = foregroundPackage;
        }

        Integer limitMinutes = limits.get(foregroundPackage);
        if (limitMinutes == null || limitMinutes <= 0) {
            hideOverlay();
            return;
        }

        if (isBypassedToday(foregroundPackage)) {
            hideOverlay();
            return;
        }

        long limitMs = limitMinutes * 60L * 1000L;
        long usedMs = getTodayUsageMs(foregroundPackage);
        if (usedMs >= limitMs) {
            showLimitOverlay(foregroundPackage, getAppName(foregroundPackage));
        } else {
            hideOverlay();
        }
    }

    private void resetDailyCachesIfNeeded() {
        String today = todayKey();
        if (today.equals(usageCacheDate)) return;
        usageCacheDate = today;
        todayUsageCache.clear();
        activeStarts.clear();
        openActivityCounts.clear();
        lastEventQueryTime = getStartOfTodayMs();
    }

    private long getStartOfTodayMs() {
        Calendar calendar = Calendar.getInstance();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        return calendar.getTimeInMillis();
    }

    private String updateUsageAndForeground(Set<String> limitedPackages) {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            long now = System.currentTimeMillis();
            if (lastEventQueryTime <= 0L) {
                lastEventQueryTime = getStartOfTodayMs();
            }
            long queryStart = Math.max(getStartOfTodayMs(), lastEventQueryTime - EVENT_QUERY_OVERLAP_MS);
            UsageEvents events = usm.queryEvents(queryStart, now);
            if (events == null) return lastForegroundPackage;

            UsageEvents.Event event = new UsageEvents.Event();
            String foreground = lastForegroundPackage;
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                String pkg = event.getPackageName();
                if (pkg == null) continue;

                int type = event.getEventType();
                long eventTime = Math.min(Math.max(event.getTimeStamp(), queryStart), now);
                if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                    if (!isSystemOrSelfPackage(pkg)) foreground = pkg;
                    if (limitedPackages.contains(pkg) && eventTime > lastEventQueryTime) {
                        int currentOpen = openActivityCounts.getOrDefault(pkg, 0);
                        if (currentOpen == 0) activeStarts.put(pkg, eventTime);
                        openActivityCounts.put(pkg, currentOpen + 1);
                    }
                } else if (
                    pkg.equals(foreground) &&
                    (type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                     type == UsageEvents.Event.ACTIVITY_PAUSED ||
                     type == UsageEvents.Event.ACTIVITY_STOPPED)
                ) {
                    foreground = "";
                }

                if (
                    limitedPackages.contains(pkg) &&
                    eventTime > lastEventQueryTime &&
                    (type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                     type == UsageEvents.Event.ACTIVITY_PAUSED ||
                     type == UsageEvents.Event.ACTIVITY_STOPPED)
                ) {
                    int currentOpen = openActivityCounts.getOrDefault(pkg, 0);
                    if (currentOpen > 0) {
                        currentOpen -= 1;
                        openActivityCounts.put(pkg, currentOpen);
                    }
                    if (currentOpen == 0) {
                        Long start = activeStarts.remove(pkg);
                        if (start != null && eventTime > start) {
                            todayUsageCache.put(pkg, todayUsageCache.getOrDefault(pkg, 0L) + (eventTime - start));
                        }
                    }
                }
            }
            lastEventQueryTime = now;
            return foreground;
        } catch (Exception ignored) {
            return lastForegroundPackage;
        }
    }

    private long getTodayUsageMs(String packageName) {
        long total = todayUsageCache.getOrDefault(packageName, 0L);
        Long activeStart = activeStarts.get(packageName);
        if (activeStart != null) {
            total += Math.max(0L, System.currentTimeMillis() - activeStart);
        }
        return total;
    }

    private void showLimitOverlay(String packageName, String appName) {
        if (!Settings.canDrawOverlays(this)) return;
        if (overlayView != null && packageName.equals(overlayPackage)) return;
        hideOverlay();

        overlayPackage = packageName;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(10), dp(22), dp(24));
        root.setBackground(makeSheetBackground());
        root.setElevation(dp(24));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            root.setTranslationZ(dp(8));
        }

        View handle = new View(this);
        handle.setBackground(makeRoundedDrawable(Color.argb(210, 212, 220, 232), dp(999)));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(42), dp(4));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = dp(20);
        root.addView(handle, handleParams);

        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams headerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        headerParams.bottomMargin = dp(14);
        root.addView(headerRow, headerParams);

        TextView badge = new TextView(this);
        badge.setText("!");
        badge.setTextColor(Color.rgb(214, 90, 90));
        badge.setTextSize(20);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setBackground(makeStrokeDrawable(
            Color.rgb(255, 235, 236),
            Color.rgb(255, 205, 210),
            dp(999)
        ));
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(dp(50), dp(50));
        badgeParams.rightMargin = dp(14);
        headerRow.addView(badge, badgeParams);

        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        headerRow.addView(titleBlock, new LinearLayout.LayoutParams(
            0,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            1f
        ));

        TextView title = new TextView(this);
        title.setText("Take five seconds");
        title.setTextColor(Color.rgb(247, 249, 255));
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        titleBlock.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText(appName);
        subtitle.setTextColor(Color.rgb(174, 184, 204));
        subtitle.setTextSize(13);
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        subtitle.setPadding(0, dp(3), 0, 0);
        titleBlock.addView(subtitle);

        TextView body = new TextView(this);
        body.setText("You set this limit for " + appName + ". Breathe for a moment, then choose whether you still want to continue.");
        body.setTextColor(Color.rgb(208, 216, 232));
        body.setTextSize(15);
        body.setLineSpacing(dp(3), 1.0f);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        bodyParams.bottomMargin = dp(20);
        root.addView(body, bodyParams);

        TextView close = new TextView(this);
        close.setText("I'm done for now");
        close.setTextColor(Color.rgb(14, 17, 24));
        close.setTextSize(16);
        close.setTypeface(Typeface.DEFAULT_BOLD);
        close.setGravity(Gravity.CENTER);
        close.setPadding(0, dp(15), 0, dp(15));
        close.setBackground(makeRoundedDrawable(Color.rgb(255, 255, 255), dp(18)));
        close.setOnClickListener(v -> {
            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
            markProtectedToday(packageName);
            hideOverlay();
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(home);
        });
        LinearLayout.LayoutParams closeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        closeParams.bottomMargin = dp(10);
        root.addView(close, closeParams);

        TextView bypass = new TextView(this);
        bypass.setText("Continue in 5");
        bypass.setEnabled(false);
        bypass.setAlpha(0.58f);
        bypass.setTextColor(Color.rgb(190, 200, 220));
        bypass.setTextSize(15);
        bypass.setTypeface(Typeface.DEFAULT_BOLD);
        bypass.setGravity(Gravity.CENTER);
        bypass.setPadding(0, dp(14), 0, dp(14));
        bypass.setBackground(makeStrokeDrawable(
            Color.argb(80, 97, 112, 140),
            Color.argb(150, 112, 128, 160),
            dp(18)
        ));
        bypass.setOnClickListener(v -> {
            v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
            markBypassedToday(packageName);
            hideOverlay();
        });
        root.addView(bypass, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));
        startBreathingCountdown(bypass);

        FrameLayout overlayContainer = new FrameLayout(this);
        overlayContainer.setClickable(true);
        overlayContainer.setFocusable(true);
        overlayContainer.setBackgroundColor(Color.argb(232, 5, 9, 16));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM
        );
        params.leftMargin = dp(10);
        params.rightMargin = dp(10);
        params.bottomMargin = dp(10);
        overlayContainer.addView(root, params);

        int overlayFlags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            overlayFlags |= WindowManager.LayoutParams.FLAG_BLUR_BEHIND;
        }

        WindowManager.LayoutParams wmParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            overlayFlags,
            PixelFormat.TRANSLUCENT
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            wmParams.setBlurBehindRadius(dp(18));
        }

        overlayView = overlayContainer;
        windowManager.addView(overlayContainer, wmParams);
        root.post(() -> {
            root.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS);
            root.setTranslationY(root.getHeight());
            ObjectAnimator.ofFloat(root, "translationY", root.getHeight(), 0f).setDuration(220).start();
        });
    }

    private void hideOverlay() {
        if (overlayView == null) return;
        try { windowManager.removeView(overlayView); } catch (Exception ignored) {}
        overlayView = null;
        overlayPackage = null;
    }

    private void startBreathingCountdown(TextView bypass) {
        final int[] remaining = {5};
        Runnable tick = new Runnable() {
            @Override
            public void run() {
                if (overlayView == null) return;
                if (remaining[0] <= 0) {
                    bypass.setEnabled(true);
                    bypass.setAlpha(1f);
                    bypass.setTextColor(Color.rgb(224, 231, 246));
                    bypass.setText("Continue anyway");
                    return;
                }
                bypass.setText("Continue in " + remaining[0]);
                remaining[0] -= 1;
                handler.postDelayed(this, 1000L);
            }
        };
        handler.post(tick);
    }

    private Map<String, Integer> readLimits() {
        HashMap<String, Integer> limits = new HashMap<>();
        SharedPreferences prefs = focusPrefs != null
            ? focusPrefs
            : getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(FocusModePrefs.KEY_LIMITS_JSON, "{}");
        try {
            JSONObject json = new JSONObject(raw);
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                int minutes = json.optInt(key, 0);
                if (minutes > 0) limits.put(key, minutes);
            }
        } catch (Exception ignored) {}
        return limits;
    }

    private Map<String, Integer> getLimits() {
        long now = System.currentTimeMillis();
        if (now - limitsLastLoaded > LIMITS_CACHE_TTL_MS) {
            cachedLimits = readLimits();
            limitsLastLoaded = now;
        }
        return cachedLimits;
    }

    private void invalidateLimitsCache() {
        limitsLastLoaded = 0L;
        cachedLimits = new HashMap<>();
    }

    private String getAppName(String packageName) {
        try {
            PackageManager pm = getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString();
        } catch (Exception ignored) {
            return "this app";
        }
    }

    private boolean isSystemOrSelfPackage(String packageName) {
        if (packageName == null) return true;
        return packageName.equals(getPackageName()) ||
            packageName.equals("android") ||
            packageName.contains("systemui") ||
            packageName.contains("launcher") ||
            packageName.contains("permissioncontroller") ||
            packageName.contains("packageinstaller");
    }

    private boolean isBypassedToday(String packageName) {
        ensureDecisionCache();
        return bypassedToday.contains(packageName);
    }

    private boolean isProtectedToday(String packageName) {
        ensureDecisionCache();
        return protectedToday.contains(packageName);
    }

    private void ensureDecisionCache() {
        String today = todayKey();
        if (today.equals(decisionsCacheDate)) return;
        decisionsCacheDate = today;
        bypassedToday.clear();
        protectedToday.clear();

        SharedPreferences prefs = focusPrefs != null
            ? focusPrefs
            : getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
        String protectedPrefix = FocusModePrefs.KEY_PROTECTED_PREFIX + today + "_";
        String bypassPrefix = FocusModePrefs.KEY_BYPASS_PREFIX + today + "_";
        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            Object value = entry.getValue();
            if (!(value instanceof Boolean) || !((Boolean) value)) continue;

            String key = entry.getKey();
            if (key.startsWith(protectedPrefix)) {
                protectedToday.add(key.substring(protectedPrefix.length()));
            } else if (key.startsWith(bypassPrefix)) {
                bypassedToday.add(key.substring(bypassPrefix.length()));
            }
        }
    }

    private void markBypassedToday(String packageName) {
        bypassedToday.add(packageName);
        decisionsCacheDate = todayKey();
        getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(FocusModePrefs.KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, true)
            .apply();
    }

    private void markProtectedToday(String packageName) {
        protectedToday.add(packageName);
        decisionsCacheDate = todayKey();
        getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(FocusModePrefs.KEY_PROTECTED_PREFIX + todayKey() + "_" + packageName, true)
            .apply();
    }

    private String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    private Notification buildNotification() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Unlure is keeping an eye on your limits")
            .setContentText("Just checking in when a selected app reaches its time.")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Privacy Focus",
            NotificationManager.IMPORTANCE_LOW
        );
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private GradientDrawable makeSheetBackground() {
        GradientDrawable d = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            new int[] {
                Color.argb(246, 31, 38, 50),
                Color.argb(246, 20, 26, 36)
            }
        );
        d.setStroke(dp(1), Color.argb(130, 78, 92, 118));
        d.setCornerRadii(new float[]{
            dp(30), dp(30),
            dp(30), dp(30),
            dp(24), dp(24),
            dp(24), dp(24)
        });
        return d;
    }

    private GradientDrawable makeRoundedDrawable(int c, int r) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(c);
        d.setCornerRadius(r);
        return d;
    }

    private GradientDrawable makeStrokeDrawable(int c, int strokeColor, int r) {
        GradientDrawable d = makeRoundedDrawable(c, r);
        d.setStroke(dp(1), strokeColor);
        return d;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
