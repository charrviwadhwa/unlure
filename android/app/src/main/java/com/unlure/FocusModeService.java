package com.unlure;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.animation.ObjectAnimator;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.usage.UsageEvents;
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
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
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

    private WindowManager windowManager;
    private View overlayView;
    private String overlayPackage;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
        AccessibilityServiceInfo info = getServiceInfo();
        if (info != null) {
            info.eventTypes =
                AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                AccessibilityEvent.TYPE_WINDOWS_CHANGED |
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
            info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
            info.notificationTimeout = 250;
            setServiceInfo(info);
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;

        String packageName = event.getPackageName().toString();
        if (packageName.equals(getPackageName()) || packageName.equals("android") || packageName.equals("com.android.systemui")) {
            return;
        }

        Map<String, Integer> limits = readLimits();
        if (limits.isEmpty() || !limits.containsKey(packageName)) {
            hideOverlay();
            return;
        }

        evaluatePackage(packageName, limits.get(packageName));
    }

    @Override
    public void onInterrupt() {
        hideOverlay();
    }

    @Override
    public void onDestroy() {
        hideOverlay();
        super.onDestroy();
    }

    private void evaluatePackage(String packageName, int limitMinutes) {
        if (limitMinutes <= 0) {
            hideOverlay();
            return;
        }

        long limitMs = limitMinutes * 60L * 1000L;
        long usedMs = getTodayUsageMs(packageName);
        String appName = getAppName(packageName);

        if (usedMs >= limitMs) {
            if (!isBypassedToday(packageName)) {
                showLimitOverlay(packageName, appName);
            }
            return;
        }

        hideOverlay();
        if (limitMs - usedMs <= WARNING_WINDOW_MS) {
            maybeSendFiveMinuteWarning(packageName, appName);
        }
    }

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
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        try {
            JSONObject names = new JSONObject(prefs.getString(KEY_NAMES_JSON, "{}"));
            String stored = names.optString(packageName, "");
            if (!stored.isEmpty()) return stored;
        } catch (Exception ignored) {}

        try {
            PackageManager pm = getPackageManager();
            return pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString();
        } catch (Exception ignored) {
            return "this app";
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
        Long activeStart = null;
        UsageEvents events = usm.queryEvents(startTime, endTime);
        if (events == null) return 0L;

        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            if (!packageName.equals(event.getPackageName())) continue;

            int type = event.getEventType();
            long eventTime = Math.min(Math.max(event.getTimeStamp(), startTime), endTime);
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                if (activeStart == null) activeStart = eventTime;
            } else if (
                type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                type == UsageEvents.Event.ACTIVITY_PAUSED ||
                type == UsageEvents.Event.ACTIVITY_STOPPED
            ) {
                if (activeStart != null && eventTime > activeStart) {
                    total += eventTime - activeStart;
                    activeStart = null;
                }
            }
        }

        if (activeStart != null && endTime > activeStart) {
            total += endTime - activeStart;
        }
        return total;
    }

    private void maybeSendFiveMinuteWarning(String packageName, String appName) {
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
            .setContentTitle("5 min left to save your streak")
            .setContentText("Close " + appName + " before the limit ends.")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(WARNING_NOTIFICATION_BASE_ID + Math.abs(packageName.hashCode() % 900), notification);
    }

    private void showLimitOverlay(String packageName, String appName) {
        if (!Settings.canDrawOverlays(this)) {
            maybeSendLimitNotification(packageName, appName);
            return;
        }
        if (overlayView != null && packageName.equals(overlayPackage)) return;
        hideOverlay();

        overlayPackage = packageName;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(12), dp(22), dp(22));
        root.setBackground(makeSheetBackground());
        root.setElevation(dp(18));

        View handle = new View(this);
        handle.setBackground(makeRoundedDrawable(Color.rgb(214, 214, 222), dp(999)));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(42), dp(4));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = dp(18);
        root.addView(handle, handleParams);

        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams headerParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        headerParams.bottomMargin = dp(10);
        root.addView(headerRow, headerParams);

        TextView badge = new TextView(this);
        badge.setText("!");
        badge.setTextColor(Color.rgb(214, 90, 90));
        badge.setTextSize(18);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setBackground(makeRoundedDrawable(Color.rgb(255, 235, 235), dp(999)));
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(dp(40), dp(40));
        badgeParams.rightMargin = dp(12);
        headerRow.addView(badge, badgeParams);

        LinearLayout titleBlock = new LinearLayout(this);
        titleBlock.setOrientation(LinearLayout.VERTICAL);
        headerRow.addView(titleBlock, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView title = new TextView(this);
        title.setText("Limit reached");
        title.setTextColor(Color.rgb(17, 17, 17));
        title.setTextSize(22);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        titleBlock.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText(appName);
        subtitle.setTextColor(Color.rgb(142, 142, 147));
        subtitle.setTextSize(13);
        subtitle.setTypeface(Typeface.DEFAULT_BOLD);
        titleBlock.addView(subtitle);

        TextView body = new TextView(this);
        body.setText("You have used today's limit. Close the app now to protect your streak, or continue knowingly.");
        body.setTextColor(Color.rgb(96, 96, 104));
        body.setTextSize(15);
        body.setLineSpacing(dp(2), 1.0f);
        body.setPadding(0, 0, 0, dp(18));
        root.addView(body);

        TextView close = new TextView(this);
        close.setText("Close app");
        close.setTextColor(Color.WHITE);
        close.setTextSize(16);
        close.setTypeface(Typeface.DEFAULT_BOLD);
        close.setGravity(Gravity.CENTER);
        close.setBackground(makeRoundedDrawable(Color.rgb(17, 17, 17), dp(18)));
        close.setPadding(0, dp(14), 0, dp(14));
        close.setOnClickListener(v -> {
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
        bypass.setText("Break streak and continue");
        bypass.setTextColor(Color.rgb(96, 96, 104));
        bypass.setTextSize(15);
        bypass.setTypeface(Typeface.DEFAULT_BOLD);
        bypass.setGravity(Gravity.CENTER);
        bypass.setBackground(makeStrokeDrawable(Color.rgb(246, 246, 248), Color.rgb(229, 229, 234), dp(18)));
        bypass.setPadding(0, dp(14), 0, dp(14));
        bypass.setOnClickListener(v -> {
            markBypassedToday(packageName);
            hideOverlay();
        });
        root.addView(bypass, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.BOTTOM;

        overlayView = root;
        windowManager.addView(root, params);
        root.post(() -> {
            root.setTranslationY(root.getHeight());
            ObjectAnimator.ofFloat(root, "translationY", root.getHeight(), 0f).setDuration(220).start();
        });
    }

    private void maybeSendLimitNotification(String packageName, String appName) {
        String todayKey = todayKey();
        String prefKey = "limit_notified_" + todayKey + "_" + packageName;
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        if (prefs.getBoolean(prefKey, false)) return;
        prefs.edit().putBoolean(prefKey, true).apply();

        Notification notification = new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("Your limit is over")
            .setContentText("Close " + appName + " to protect your streak.")
            .setAutoCancel(true)
            .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.notify(WARNING_NOTIFICATION_BASE_ID + 1000 + Math.abs(packageName.hashCode() % 900), notification);
    }

    private void hideOverlay() {
        if (overlayView == null) return;
        try {
            windowManager.removeView(overlayView);
        } catch (Exception ignored) {}
        overlayView = null;
        overlayPackage = null;
    }

    private GradientDrawable makeSheetBackground() {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(Color.WHITE);
        drawable.setCornerRadii(new float[] {
            dp(28), dp(28),
            dp(28), dp(28),
            0, 0,
            0, 0
        });
        return drawable;
    }

    private GradientDrawable makeRoundedDrawable(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private GradientDrawable makeStrokeDrawable(int color, int strokeColor, int radius) {
        GradientDrawable drawable = makeRoundedDrawable(color, radius);
        drawable.setStroke(dp(1), strokeColor);
        return drawable;
    }

    private boolean isBypassedToday(String packageName) {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, false);
    }

    private void markBypassedToday(String packageName) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_BYPASS_PREFIX + todayKey() + "_" + packageName, true)
            .apply();
    }

    private void markProtectedToday(String packageName) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_PROTECTED_PREFIX + todayKey() + "_" + packageName, true)
            .apply();
    }

    private String todayKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().getTime());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Focus Mode",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.createNotificationChannel(channel);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
