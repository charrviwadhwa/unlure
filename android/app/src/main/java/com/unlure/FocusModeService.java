package com.unlure;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.animation.ObjectAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
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
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.List;

import org.json.JSONObject;

public class FocusModeService extends AccessibilityService {
    public static final String PREFS_NAME = "FocusModePrefs";
    public static final String KEY_LIMITS_JSON = "limits_json";
    public static final String KEY_NAMES_JSON = "names_json";
    public static final String KEY_PROTECTED_PREFIX = "protected_";
    public static final String KEY_BYPASS_PREFIX = "bypass_";

    private static final String CHANNEL_ID = "unlure_focus_mode";
    private static final int WARNING_NOTIFICATION_BASE_ID = 4000;
    private static final long WARNING_WINDOW_MS = 5L * 60L * 1000L;
    private static final long OVERLAY_GRACE_MS = 10L * 1000L;
    private static final long POST_CLOSE_IGNORE_MS = 3500L;

    private WindowManager windowManager;
    private View overlayView;
    private String overlayPackage;

    // Session State Management
    private String currentActivePackage = "";
    private long sessionStartTime = 0L;
    private long baseUsageAtStart = 0L;
    private Handler sessionHandler = new Handler(Looper.getMainLooper());
    private Runnable limitRunnable;
    private Runnable warningRunnable;
    private String recentlyClosedPackage = "";
    private long recentlyClosedAt = 0L;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;

        String packageName = event.getPackageName().toString();
        if (isRecentlyClosedPackage(packageName)) {
            android.util.Log.d("FocusMode", "ignore stale event after close pkg=" + packageName);
            stopSession();
            hideOverlay();
            return;
        }

        // 1. IGNORE SYSTEM DIALOGS (Fix for Error 3 in video)
        // This prevents the permission dialog or volume slider from killing the timer
        if (packageName.contains("permissioncontroller") || 
            packageName.contains("systemui") || 
            packageName.contains("packageinstaller")) {
            return; 
        }

        // 2. STOP SESSION IF HOME OR UNLURE
        if (packageName.equals(getPackageName())) {
            if (overlayView == null) {
                protectCurrentSessionIfClosedAfterLimit("self");
                stopSession();
                hideOverlay();
            }
            return;
        }

        if (packageName.equals("android") || packageName.contains("launcher")) {
            protectCurrentSessionIfClosedAfterLimit("launcher");
            stopSession();
            hideOverlay();
            return;
        }

        Map<String, Integer> limits = readLimits();
        if (!limits.containsKey(packageName) || limits.get(packageName) <= 0) {
            protectCurrentSessionIfClosedAfterLimit("non-limited:" + packageName);
            stopSession();
            hideOverlay();
            return;
        }

        // 3. START NEW SESSION IF APP CHANGED
        // This prevents internal WhatsApp/Instagram events from resetting the limit
        if (!packageName.equals(currentActivePackage)) {
            startSession(packageName, limits.get(packageName));
        }
    }

    private void startSession(String packageName, int limitMinutes) {
        stopSession();
        
        currentActivePackage = packageName;
        baseUsageAtStart = getTodayUsageMs(packageName);
        sessionStartTime = System.currentTimeMillis();
        long limitMs = limitMinutes * 60L * 1000L;
        String appName = getAppName(packageName);

        long remainingMs = limitMs - baseUsageAtStart;
        android.util.Log.d("FocusMode", "startSession pkg=" + packageName
            + " limitMs=" + limitMs
            + " baseUsageMs=" + baseUsageAtStart
            + " remainingMs=" + remainingMs);

        if (isBypassedToday(packageName)) {
            return;
        }

        if (remainingMs <= -OVERLAY_GRACE_MS) {
            if (!isBypassedToday(packageName)) {
                if (isPackageInForeground(packageName)) {
                    showLimitOverlay(packageName, appName);
                } else {
                    android.util.Log.d("FocusMode", "skip immediate overlay; not foreground pkg=" + packageName);
                    stopSession();
                    hideOverlay();
                }
            }
            return;
        }

        long overlayDelayMs = Math.max(0L, remainingMs + OVERLAY_GRACE_MS);
        limitRunnable = () -> {
            if (packageName.equals(currentActivePackage) && !isBypassedToday(packageName)) {
                if (!isPackageInForeground(packageName)) {
                    protectCurrentSessionIfClosedAfterLimit("timer-not-foreground");
                    android.util.Log.d("FocusMode", "skip timer overlay; not foreground pkg=" + packageName);
                    stopSession();
                    hideOverlay();
                    return;
                }
                android.util.Log.d("FocusMode", "limit timer fired pkg=" + packageName);
                showLimitOverlay(packageName, appName);
            }
        };
        sessionHandler.postDelayed(limitRunnable, overlayDelayMs);

        if (remainingMs <= WARNING_WINDOW_MS) {
            maybeSendLimitWarning(packageName, appName, remainingMs);
        } else {
            warningRunnable = () -> {
                if (packageName.equals(currentActivePackage) && isPackageInForeground(packageName)) {
                    maybeSendLimitWarning(packageName, appName, WARNING_WINDOW_MS);
                }
            };
            sessionHandler.postDelayed(warningRunnable, remainingMs - WARNING_WINDOW_MS);
        }
    }

    private void protectCurrentSessionIfClosedAfterLimit(String reason) {
        if (currentActivePackage == null || currentActivePackage.isEmpty()) return;
        if (isBypassedToday(currentActivePackage) || isProtectedToday(currentActivePackage)) return;

        Map<String, Integer> limits = readLimits();
        Integer limitMinutes = limits.get(currentActivePackage);
        if (limitMinutes == null || limitMinutes <= 0) return;

        long limitMs = limitMinutes * 60L * 1000L;
        long usedMs = getTodayUsageMs(currentActivePackage);
        if (usedMs >= limitMs) {
            markProtectedToday(currentActivePackage);
            android.util.Log.d("FocusMode", "protected by close pkg=" + currentActivePackage
                + " reason=" + reason
                + " usedMs=" + usedMs
                + " limitMs=" + limitMs);
        }
    }

    private boolean isPackageInForeground(String packageName) {
        try {
            android.view.accessibility.AccessibilityNodeInfo root = getRootInActiveWindow();
            if (root != null) {
                CharSequence rootPackage = root.getPackageName();
                root.recycle();
                if (rootPackage != null) {
                    String rootPackageName = rootPackage.toString();
                    if (packageName.equals(rootPackageName)) return true;
                    if (!isSystemOrSelfPackage(rootPackageName)) return false;
                }
            }
        } catch (Exception ignored) {}

        try {
            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            long now = System.currentTimeMillis();
            UsageEvents events = usm.queryEvents(now - 8000L, now);
            if (events == null) return packageName.equals(currentActivePackage);

            UsageEvents.Event event = new UsageEvents.Event();
            String lastForegroundPackage = null;
            boolean targetActive = packageName.equals(currentActivePackage);
            while (events.hasNextEvent()) {
                events.getNextEvent(event);
                String eventPackage = event.getPackageName();
                if (eventPackage == null) continue;

                int type = event.getEventType();
                if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                    if (!isSystemOrSelfPackage(eventPackage)) {
                        lastForegroundPackage = eventPackage;
                    }
                    targetActive = packageName.equals(eventPackage);
                } else if (
                    packageName.equals(eventPackage) &&
                    (type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                     type == UsageEvents.Event.ACTIVITY_PAUSED ||
                     type == UsageEvents.Event.ACTIVITY_STOPPED)
                ) {
                    targetActive = false;
                }
            }

            if (lastForegroundPackage != null) {
                return packageName.equals(lastForegroundPackage) && targetActive;
            }
        } catch (Exception ignored) {}

        return packageName.equals(currentActivePackage);
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

    private void stopSession() {
        if (limitRunnable != null) sessionHandler.removeCallbacks(limitRunnable);
        if (warningRunnable != null) sessionHandler.removeCallbacks(warningRunnable);
        limitRunnable = null;
        warningRunnable = null;
        currentActivePackage = "";
        baseUsageAtStart = 0L;
        sessionStartTime = 0L;
    }

    private boolean isRecentlyClosedPackage(String packageName) {
        return packageName != null &&
            packageName.equals(recentlyClosedPackage) &&
            System.currentTimeMillis() - recentlyClosedAt <= POST_CLOSE_IGNORE_MS;
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
        root.setElevation(dp(18));

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
        body.setText("Close the app now to protect your streak, or continue knowing today will count as over limit.");
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
            markProtectedToday(packageName);
            rememberRecentlyClosedPackage(packageName);
            hideOverlay();
            stopSession(); // Fix for Error 1: Stop the ghost overlay loop
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
        bypass.setText("Break streak and continue");
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
            markBypassedToday(packageName);
            hideOverlay();
            stopSession(); // Fix for Error 1
        });
        root.addView(bypass, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        FrameLayout overlayContainer = new FrameLayout(this);
        overlayContainer.setBackgroundColor(Color.argb(154, 5, 9, 16));
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        params.leftMargin = dp(10);
        params.rightMargin = dp(10);
        params.bottomMargin = dp(10);
        overlayContainer.addView(root, params);

        WindowManager.LayoutParams wmParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? 
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );

        overlayView = overlayContainer;
        windowManager.addView(overlayContainer, wmParams);
        root.post(() -> {
            root.setTranslationY(root.getHeight());
            ObjectAnimator.ofFloat(root, "translationY", root.getHeight(), 0f).setDuration(220).start();
        });
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
        if (events == null) return 0L;

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
            } else if (type == UsageEvents.Event.DEVICE_SHUTDOWN || type == UsageEvents.Event.DEVICE_STARTUP) {
                if (activeStart != null && eventTime > activeStart) {
                    total += eventTime - activeStart;
                    activeStart = null;
                }
                openActivityCount = 0;
            }
        }

        if (activeStart != null && endTime > activeStart) {
            total += Math.min(endTime - activeStart, maxWindow);
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

        long usageMs = total;
        if (usageMs <= 0L) {
            usageMs = statsTotal;
        } else if (statsTotal > usageMs && statsTotal - usageMs <= 90L * 1000L) {
            usageMs = statsTotal;
        }

        android.util.Log.d("FocusMode", "usage pkg=" + packageName
            + " eventsMs=" + total
            + " statsMs=" + statsTotal
            + " chosenMs=" + usageMs);
        return usageMs;
    }

    private void hideOverlay() {
        if (overlayView == null) return;
        try { windowManager.removeView(overlayView); } catch (Exception ignored) {}
        overlayView = null;
        overlayPackage = null;
    }

    // Helper UI methods (makeSheetBackground, dp, etc.) remain as previously defined.
    // ...
    @Override public void onInterrupt() { hideOverlay(); }
    @Override public void onDestroy() { stopSession(); hideOverlay(); super.onDestroy(); }

    private Map<String, Integer> readLimits() {
        HashMap<String, Integer> limits = new HashMap<>();
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_LIMITS_JSON, "{}");
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
        } catch (Exception ignored) { return "this app"; }
    }

    private boolean isBypassedToday(String packageName) {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, false);
    }

    private boolean isProtectedToday(String packageName) {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_PROTECTED_PREFIX + todayKey() + "_" + packageName, false);
    }

    private void markBypassedToday(String packageName) {
        boolean saved = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, true)
            .commit();
        android.util.Log.d("FocusMode", "markBypassedToday pkg=" + packageName + " saved=" + saved);
    }

    private void markProtectedToday(String packageName) {
        boolean saved = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putBoolean(KEY_PROTECTED_PREFIX + todayKey() + "_" + packageName, true)
            .commit();
        android.util.Log.d("FocusMode", "markProtectedToday pkg=" + packageName + " saved=" + saved);
    }

    private void rememberRecentlyClosedPackage(String packageName) {
        recentlyClosedPackage = packageName;
        recentlyClosedAt = System.currentTimeMillis();
    }

    private String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Focus Mode", NotificationManager.IMPORTANCE_DEFAULT);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private void maybeSendLimitWarning(String packageName, String appName, long remainingMs) {
        String todayKey = todayKey();
        String prefKey = "warned_" + todayKey + "_" + packageName;
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (prefs.getBoolean(prefKey, false)) return;
        prefs.edit().putBoolean(prefKey, true).apply();

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(formatRemainingWarningTitle(remainingMs))
            .setContentText("Close " + appName + " before the limit ends.")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(WARNING_NOTIFICATION_BASE_ID + Math.abs(packageName.hashCode() % 900), notification);
    }

    private String formatRemainingWarningTitle(long remainingMs) {
        if (remainingMs <= 0L) return "Limit reached";
        long seconds = (long) Math.ceil(remainingMs / 1000.0);
        if (seconds < 60L) return "Less than 1 min left";
        long minutes = (long) Math.ceil(seconds / 60.0);
        return minutes + " " + (minutes == 1L ? "min" : "mins") + " left to save your streak";
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

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
}
