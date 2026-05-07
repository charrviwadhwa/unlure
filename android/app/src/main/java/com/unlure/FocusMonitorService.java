package com.unlure;

import android.animation.ObjectAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
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
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class FocusMonitorService extends Service {
    private static final String CHANNEL_ID = "unlure_privacy_focus";
    private static final int NOTIFICATION_ID = 3101;
    private static final long POLL_MS = 2500L;
    private static final long LOOKBACK_MS = 15000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private View overlayView;
    private String overlayPackage;
    private String lastForegroundPackage = "";
    private Runnable pollRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
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
        hideOverlay();
        super.onDestroy();
    }

    private void startPolling() {
        if (pollRunnable != null) return;
        pollRunnable = () -> {
            checkForegroundApp();
            handler.postDelayed(pollRunnable, POLL_MS);
        };
        handler.post(pollRunnable);
    }

    private void checkForegroundApp() {
        Map<String, Integer> limits = readLimits();
        if (limits.isEmpty()) {
            stopSelf();
            return;
        }

        String foregroundPackage = getForegroundPackage();
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

        if (isBypassedToday(foregroundPackage)) return;

        long limitMs = limitMinutes * 60L * 1000L;
        long usedMs = getTodayUsageMs(foregroundPackage);
        if (usedMs >= limitMs) {
            showLimitOverlay(foregroundPackage, getAppName(foregroundPackage));
        }
    }

    private String getForegroundPackage() {
        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            long now = System.currentTimeMillis();
            UsageEvents events = usm.queryEvents(now - LOOKBACK_MS, now);
            if (events == null) return lastForegroundPackage;

            UsageEvents.Event event = new UsageEvents.Event();
            String foreground = lastForegroundPackage;
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                String pkg = event.getPackageName();
                if (pkg == null) continue;

                int type = event.getEventType();
                if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                    if (!isSystemOrSelfPackage(pkg)) foreground = pkg;
                } else if (
                    pkg.equals(foreground) &&
                    (type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                     type == UsageEvents.Event.ACTIVITY_PAUSED ||
                     type == UsageEvents.Event.ACTIVITY_STOPPED)
                ) {
                    foreground = "";
                }
            }
            return foreground;
        } catch (Exception ignored) {
            return lastForegroundPackage;
        }
    }

    private long getTodayUsageMs(String packageName) {
        UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
        Calendar calendar = Calendar.getInstance();
        long endTime = calendar.getTimeInMillis();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        long startTime = calendar.getTimeInMillis();

        long total = 0L;
        long maxWindow = Math.max(endTime - startTime, 0L);
        UsageEvents events = usm.queryEvents(startTime, endTime);
        if (events != null) {
            UsageEvents.Event event = new UsageEvents.Event();
            Long activeStart = null;
            int openActivityCount = 0;
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                if (!packageName.equals(event.getPackageName())) continue;

                int type = event.getEventType();
                long eventTime = Math.min(Math.max(event.getTimeStamp(), startTime), endTime);
                if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                    if (openActivityCount == 0) activeStart = eventTime;
                    openActivityCount++;
                } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND || type == UsageEvents.Event.ACTIVITY_PAUSED) {
                    if (openActivityCount > 0) openActivityCount--;
                    if (openActivityCount == 0 && activeStart != null && eventTime > activeStart) {
                        total += eventTime - activeStart;
                        activeStart = null;
                    }
                } else if (type == UsageEvents.Event.ACTIVITY_STOPPED) {
                    if (openActivityCount == 0 && activeStart != null && eventTime > activeStart) {
                        total += eventTime - activeStart;
                        activeStart = null;
                    }
                }
            }

            if (activeStart != null && endTime > activeStart) {
                total += Math.min(endTime - activeStart, maxWindow);
            }
        }

        long statsTotal = 0L;
        try {
            List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
            if (stats != null) {
                for (UsageStats stat : stats) {
                    if (!packageName.equals(stat.getPackageName())) continue;
                    long foreground = stat.getTotalTimeInForeground();
                    long visible = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? stat.getTotalTimeVisible()
                        : 0L;
                    statsTotal = Math.max(statsTotal, Math.max(foreground, visible));
                }
            }
        } catch (Exception ignored) {}

        if (total <= 0L) return statsTotal;
        if (statsTotal > total && statsTotal - total <= 90L * 1000L) return statsTotal;
        return total;
    }

    private void showLimitOverlay(String packageName, String appName) {
        if (!Settings.canDrawOverlays(this)) return;
        if (overlayView != null && packageName.equals(overlayPackage)) return;
        hideOverlay();

        overlayPackage = packageName;
        int streakShieldCount = getStreakShieldCount();
        String shieldLabel = formatStreakShieldLabel(streakShieldCount);

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
        title.setText("Limit reached");
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
        body.setText("Close the app now to protect " + shieldLabel + ". Continuing spends that shield and marks today over limit.");
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
        close.setText("Close app");
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
        bypass.setText(streakShieldCount > 0 ? "Spend shield and continue" : "Break streak and continue");
        bypass.setTextColor(Color.rgb(224, 231, 246));
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

    private Map<String, Integer> readLimits() {
        HashMap<String, Integer> limits = new HashMap<>();
        SharedPreferences prefs = getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
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
        return getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(FocusModePrefs.KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, false);
    }

    private void markBypassedToday(String packageName) {
        getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(FocusModePrefs.KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, true)
            .apply();
    }

    private void markProtectedToday(String packageName) {
        getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(FocusModePrefs.KEY_PROTECTED_PREFIX + todayKey() + "_" + packageName, true)
            .apply();
    }

    private int getStreakShieldCount() {
        return Math.max(0, getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE)
            .getInt(FocusModePrefs.KEY_STREAK_SHIELD_COUNT, 0));
    }

    private String formatStreakShieldLabel(int count) {
        if (count <= 0) return "your streak";
        if (count == 1) return "your 1-day streak shield";
        return "your " + count + "-day streak shield";
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
            .setContentTitle("Unlure is watching selected limits")
            .setContentText("Privacy-first mode uses usage totals, not screen content.")
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
