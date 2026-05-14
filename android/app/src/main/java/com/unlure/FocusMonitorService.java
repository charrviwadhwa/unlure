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
import android.util.Log;
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
import java.util.Set;

public class FocusMonitorService extends Service {

    private static final String TAG = "FocusMode";
    private static final String CHANNEL_ID = "unlure_focus";
    private static final int NOTIFICATION_ID = 3101;

    private static final long POLL_MS = 1200L;
    private static final long SCREEN_OFF_POLL_MS = 10000L;
    private static final long ACTIVE_AT_START_LOOKBACK_MS = 2L * 60L * 60L * 1000L;

    private final Handler handler =
            new Handler(Looper.getMainLooper());

    private WindowManager windowManager;

    private View overlayView;

    private String overlayPackage = "";

    private String lastForegroundPackage = "";

    private Runnable pollRunnable;

    private SharedPreferences prefs;

    private final Map<String, Long> usageCache =
            new HashMap<>();

    private final Map<String, Long> activeStarts =
            new HashMap<>();

    private String liveUsagePackage = "";

    private long liveUsageStartMs = 0L;

    private long liveStatsBaseMs = 0L;

    private final BroadcastReceiver screenReceiver =
            new BroadcastReceiver() {
                @Override
                public void onReceive(
                        Context context,
                        Intent intent
                ) {

                    if (intent == null) return;

                    String action = intent.getAction();

                    if (Intent.ACTION_SCREEN_OFF.equals(action)) {

                        handler.removeCallbacks(pollRunnable);

                        hideOverlay();

                    } else if (
                            Intent.ACTION_SCREEN_ON.equals(action)
                    ) {

                        handler.removeCallbacks(pollRunnable);

                        handler.post(pollRunnable);
                    }
                }
            };

    @Override
    public void onCreate() {

        super.onCreate();
        Log.d(TAG, "service onCreate");

        windowManager =
                (WindowManager) getSystemService(WINDOW_SERVICE);

        prefs =
                getSharedPreferences(
                        FocusModePrefs.PREFS_NAME,
                        MODE_PRIVATE
                );

        registerScreenReceiver();

        createNotificationChannel();

        startForeground(
                NOTIFICATION_ID,
                buildNotification()
        );

        startPolling();
    }

    @Override
    public int onStartCommand(
            Intent intent,
            int flags,
            int startId
    ) {

        Log.d(TAG, "service onStartCommand");
        startPolling();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {

        Log.d(TAG, "service onDestroy");
        handler.removeCallbacksAndMessages(null);

        try {
            unregisterReceiver(screenReceiver);
        } catch (Exception ignored) {}

        hideOverlay();

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // =========================================================
    // POLLING
    // =========================================================

    private void startPolling() {

        if (pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }

        Log.d(TAG, "startPolling");

        pollRunnable = new Runnable() {
            @Override
            public void run() {

                checkForegroundApp();

                handler.postDelayed(
                        this,
                        isScreenInteractive()
                                ? POLL_MS
                                : SCREEN_OFF_POLL_MS
                );
            }
        };

        handler.post(pollRunnable);
    }

    private void registerScreenReceiver() {

        IntentFilter filter = new IntentFilter();

        filter.addAction(Intent.ACTION_SCREEN_ON);

        filter.addAction(Intent.ACTION_SCREEN_OFF);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {

            registerReceiver(
                    screenReceiver,
                    filter,
                    Context.RECEIVER_NOT_EXPORTED
            );

        } else {

            registerReceiver(screenReceiver, filter);
        }
    }

    private boolean isScreenInteractive() {

        try {

            PowerManager pm =
                    (PowerManager) getSystemService(POWER_SERVICE);

            if (pm == null) return true;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
                return pm.isInteractive();
            }

            return pm.isScreenOn();

        } catch (Exception ignored) {

            return true;
        }
    }

    // =========================================================
    // FOREGROUND CHECK
    // =========================================================

    private void checkForegroundApp() {

        Map<String, Integer> limits = readLimits();
        Log.d(TAG, "check limitsCount=" + limits.size());

        if (limits.isEmpty()) {
            Log.d(TAG, "hide: no limits");
            hideOverlay();
            return;
        }

        String foreground =
                getForegroundApp();
        Log.d(TAG, "foreground=" + foreground);

        if (foreground == null
                || foreground.isEmpty()
                || isSystemOrSelfPackage(foreground)) {

            Log.d(TAG, "hide: invalid foreground=" + foreground);
            resetLiveUsageTopUp();
            hideOverlay();
            return;
        }

        lastForegroundPackage = foreground;

        Integer limitMinutes =
                limits.get(foreground);

        if (limitMinutes == null
                || limitMinutes <= 0) {

            Log.d(TAG, "hide: no limit for foreground=" + foreground);
            resetLiveUsageTopUp();
            hideOverlay();
            return;
        }

        if (isBypassedToday(foreground)) {

            Log.d(TAG, "hide: bypassed today foreground=" + foreground);
            hideOverlay();
            return;
        }

        long used =
                getTodayUsageMs(foreground);

        long limit =
                limitMinutes * 60L * 1000L;

        Log.d(TAG, "check foreground=" + foreground + " usedMs=" + used + " limitMs=" + limit);

        if (used >= limit) {

            showLimitOverlay(
                    foreground,
                    getAppName(foreground)
            );

        } else {

            hideOverlay();
        }
    }

    // =========================================================
    // FOREGROUND DETECTION
    // =========================================================

    private String getForegroundApp() {

        try {

            UsageStatsManager usm =
                    (UsageStatsManager)
                            getSystemService(
                                    Context.USAGE_STATS_SERVICE
                            );

            long now =
                    System.currentTimeMillis();

            UsageEvents events =
                    usm.queryEvents(now - 5000, now);

            if (events == null) {
                return lastForegroundPackage;
            }

            UsageEvents.Event event =
                    new UsageEvents.Event();

            String latest =
                    lastForegroundPackage;

            long latestTime = 0;

            while (events.hasNextEvent()) {

                events.getNextEvent(event);

                int type =
                        event.getEventType();

                if (type ==
                        UsageEvents.Event.MOVE_TO_FOREGROUND
                        || type ==
                        UsageEvents.Event.ACTIVITY_RESUMED) {

                    String pkg =
                            event.getPackageName();

                    if (pkg == null) continue;

                    if (event.getTimeStamp() > latestTime) {

                        latest = pkg;

                        latestTime =
                                event.getTimeStamp();
                    }
                }
            }

            return latest;

        } catch (Exception e) {

            return lastForegroundPackage;
        }
    }

    // =========================================================
    // USAGE TIME
    // =========================================================

    private long getTodayUsageMs(String packageName) {
        try {
            UsageStatsManager usm =
                    (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);

            Calendar calendar = Calendar.getInstance();
            long endTime = calendar.getTimeInMillis();
            calendar.set(Calendar.HOUR_OF_DAY, 0);
            calendar.set(Calendar.MINUTE, 0);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            long startTime = calendar.getTimeInMillis();
            long maxWindow = Math.max(endTime - startTime, 0L);

            long total = 0L;
            Long activeStart = isPackageActiveAtStart(usm, packageName, startTime)
                    ? startTime
                    : null;
            int openActivityCount = activeStart != null ? 1 : 0;

            UsageEvents events = usm.queryEvents(startTime, endTime);
            if (events != null) {
                UsageEvents.Event event = new UsageEvents.Event();

                while (events.hasNextEvent()) {
                    events.getNextEvent(event);
                    if (!packageName.equals(event.getPackageName())) continue;

                    int type = event.getEventType();
                    long eventTime = Math.min(Math.max(event.getTimeStamp(), startTime), endTime);

                    if (type == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                            type == UsageEvents.Event.ACTIVITY_RESUMED) {
                        if (openActivityCount == 0) {
                            activeStart = eventTime;
                        }
                        openActivityCount++;
                    } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                            type == UsageEvents.Event.ACTIVITY_PAUSED) {
                        if (openActivityCount > 0) {
                            openActivityCount--;
                        }

                        if (openActivityCount == 0 && activeStart != null && eventTime > activeStart) {
                            total = addUsageDelta(total, eventTime - activeStart, maxWindow);
                            activeStart = null;
                        }
                    } else if (type == UsageEvents.Event.ACTIVITY_STOPPED) {
                        if (openActivityCount == 0 && activeStart != null && eventTime > activeStart) {
                            total = addUsageDelta(total, eventTime - activeStart, maxWindow);
                            activeStart = null;
                        }
                    } else if (type == UsageEvents.Event.DEVICE_SHUTDOWN ||
                            type == UsageEvents.Event.DEVICE_STARTUP) {
                        if (activeStart != null && eventTime > activeStart) {
                            total = addUsageDelta(total, eventTime - activeStart, maxWindow);
                        }
                        activeStart = null;
                        openActivityCount = 0;
                    }
                }
            }

            if (activeStart != null && endTime > activeStart) {
                total = addUsageDelta(total, endTime - activeStart, maxWindow);
            }

            Log.d(TAG, "usage-ui-algo package=" + packageName + " totalMs=" + total);
            return total;
        } catch (Exception e) {
            Log.e(TAG, "usage calculation failed package=" + packageName, e);
            return 0L;
        }
    }

    private long addUsageDelta(long currentTotal, long delta, long maxWindow) {
        long safeDelta = Math.min(Math.max(delta, 0L), maxWindow);
        return Math.min(currentTotal + safeDelta, maxWindow);
    }

    private boolean isPackageActiveAtStart(
            UsageStatsManager usm,
            String packageName,
            long startTime
    ) {
        long lookbackStart = startTime - ACTIVE_AT_START_LOOKBACK_MS;
        UsageEvents previousEvents = usm.queryEvents(lookbackStart, startTime);
        if (previousEvents == null) return false;

        int lastType = -1;
        UsageEvents.Event event = new UsageEvents.Event();
        while (previousEvents.hasNextEvent()) {
            previousEvents.getNextEvent(event);
            if (!packageName.equals(event.getPackageName())) continue;

            int type = event.getEventType();
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                    type == UsageEvents.Event.ACTIVITY_RESUMED ||
                    type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                    type == UsageEvents.Event.ACTIVITY_PAUSED ||
                    type == UsageEvents.Event.ACTIVITY_STOPPED ||
                    type == UsageEvents.Event.DEVICE_SHUTDOWN ||
                    type == UsageEvents.Event.DEVICE_STARTUP) {
                lastType = type;
            }
        }

        return lastType == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                lastType == UsageEvents.Event.ACTIVITY_RESUMED;
    }

    private void resetLiveUsageTopUp() {

        liveUsagePackage = "";
        liveUsageStartMs = 0L;
        liveStatsBaseMs = 0L;
    }

    // =========================================================
    // OVERLAY
    // =========================================================

    private void showLimitOverlay(
            String packageName,
            String appName
    ) {

        if (!Settings.canDrawOverlays(this)) {
            Log.d(TAG, "overlay blocked: missing draw-over-apps permission");
            return;
        }

        if (overlayView != null) {
            Log.d(TAG, "overlay already visible package=" + overlayPackage);
            return;
        }

        overlayPackage = packageName;

        LinearLayout root =
                new LinearLayout(this);

        root.setOrientation(
                LinearLayout.VERTICAL
        );

        root.setPadding(
                dp(22),
                dp(14),
                dp(22),
                dp(28)
        );

        root.setBackground(
                makeSheetBackground()
        );

        TextView title =
                new TextView(this);

        title.setText("Limit reached");

        title.setTextColor(
                Color.WHITE
        );

        title.setTextSize(24);

        title.setTypeface(
                Typeface.DEFAULT_BOLD
        );

        root.addView(title);

        TextView subtitle =
                new TextView(this);

        subtitle.setText(appName);

        subtitle.setTextColor(
                Color.rgb(180, 190, 210)
        );

        subtitle.setPadding(
                0,
                dp(6),
                0,
                dp(12)
        );

        root.addView(subtitle);

        TextView body =
                new TextView(this);

        body.setText(
                "You have hit your limit for "
                        + appName
                        + ". Step away to keep your streak protected, or pause briefly before choosing to continue."
        );

        body.setTextColor(
                Color.rgb(220, 225, 235)
        );

        body.setTextSize(15);

        body.setLineSpacing(dp(2), 1f);

        root.addView(body);

        TextView close =
                new TextView(this);

        close.setText("I'm done for now");

        close.setGravity(Gravity.CENTER);

        close.setTextColor(Color.BLACK);

        close.setTextSize(16);

        close.setTypeface(Typeface.DEFAULT_BOLD);

        close.setPadding(
                0,
                dp(15),
                0,
                dp(15)
        );

        close.setBackground(
                makeRoundedDrawable(
                        Color.WHITE,
                        dp(18)
                )
        );

        LinearLayout.LayoutParams closeParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        closeParams.topMargin = dp(20);

        root.addView(close, closeParams);

        close.setOnClickListener(v -> {

            markProtectedToday(packageName);
            hideOverlay();

            Intent home =
                    new Intent(Intent.ACTION_MAIN);

            home.addCategory(Intent.CATEGORY_HOME);

            home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            startActivity(home);
        });

        TextView bypass =
                new TextView(this);

        bypass.setText("Continue in 3");
        bypass.setEnabled(false);
        bypass.setAlpha(0.58f);

        bypass.setGravity(Gravity.CENTER);

        bypass.setTextColor(
                Color.rgb(210, 220, 240)
        );

        bypass.setTypeface(
                Typeface.DEFAULT_BOLD
        );

        bypass.setPadding(
                0,
                dp(15),
                0,
                dp(15)
        );

        bypass.setBackground(
                makeStrokeDrawable(
                        Color.TRANSPARENT,
                        Color.argb(120, 120, 130, 160),
                        dp(18)
                )
        );

        LinearLayout.LayoutParams bypassParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        bypassParams.topMargin = dp(12);

        root.addView(bypass, bypassParams);

        bypass.setOnClickListener(v -> {
            markBypassedToday(packageName);
            hideOverlay();
        });

        startContinueCountdown(bypass);

        FrameLayout container =
                new FrameLayout(this);

        container.setClickable(true);

        container.setFocusable(true);

        container.setFocusableInTouchMode(true);

        container.setBackgroundColor(
                Color.argb(230, 0, 0, 0)
        );

        FrameLayout.LayoutParams sheetParams =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.BOTTOM
                );

        container.addView(root, sheetParams);

        int flags =
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_DIM_BEHIND;

        WindowManager.LayoutParams wmParams =
                new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT,
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                                : WindowManager.LayoutParams.TYPE_PHONE,
                        flags,
                        PixelFormat.TRANSLUCENT
                );

        wmParams.gravity = Gravity.TOP;

        wmParams.dimAmount = 0.6f;

        try {

            if (overlayView != null) {

                windowManager.removeViewImmediate(
                        overlayView
                );

                overlayView = null;
            }

        } catch (Exception ignored) {}

        overlayView = container;

        try {
            windowManager.addView(
                    container,
                    wmParams
            );
            Log.d(TAG, "overlay shown package=" + packageName);
        } catch (Exception e) {
            overlayView = null;
            overlayPackage = "";
            Log.e(TAG, "overlay addView failed package=" + packageName, e);
            return;
        }

        root.post(() -> {

            root.performHapticFeedback(
                    HapticFeedbackConstants.LONG_PRESS
            );

            root.setTranslationY(root.getHeight());

            ObjectAnimator
                    .ofFloat(
                            root,
                            "translationY",
                            root.getHeight(),
                            0f
                    )
                    .setDuration(220)
                    .start();
        });
    }

    private void hideOverlay() {

        if (overlayView == null) return;

        try {

            windowManager.removeViewImmediate(
                    overlayView
            );

        } catch (Exception ignored) {}

        overlayView = null;

        overlayPackage = "";
    }

    private void startContinueCountdown(TextView bypass) {

        final int[] remaining = {3};

        Runnable tick =
                new Runnable() {
                    @Override
                    public void run() {

                        if (overlayView == null) return;

                        if (remaining[0] <= 0) {
                            bypass.setEnabled(true);
                            bypass.setAlpha(1f);
                            bypass.setText("Continue anyway");
                            return;
                        }

                        bypass.setText(
                                "Continue in "
                                        + remaining[0]
                        );

                        remaining[0] -= 1;

                        handler.postDelayed(this, 1000L);
                    }
                };

        handler.post(tick);
    }

    // =========================================================
    // HELPERS
    // =========================================================

    private Map<String, Integer> readLimits() {

        HashMap<String, Integer> limits =
                new HashMap<>();

        String raw =
                prefs.getString(
                        FocusModePrefs.KEY_LIMITS_JSON,
                        "{}"
                );
        Log.d(TAG, "readLimits raw=" + raw);

        try {

            JSONObject json =
                    new JSONObject(raw);

            Iterator<String> keys =
                    json.keys();

            while (keys.hasNext()) {

                String key =
                        keys.next();

                int minutes =
                        json.optInt(key, 0);

                if (minutes > 0) {
                    limits.put(key, minutes);
                }
            }

        } catch (Exception ignored) {}

        return limits;
    }

    private String getAppName(String pkg) {

        try {

            PackageManager pm =
                    getPackageManager();

            return pm.getApplicationLabel(
                    pm.getApplicationInfo(pkg, 0)
            ).toString();

        } catch (Exception ignored) {

            return "this app";
        }
    }

    private boolean isSystemOrSelfPackage(String pkg) {

        if (pkg == null) return true;

        return pkg.equals(getPackageName())
                || pkg.equals("android")
                || pkg.equals("com.android.systemui");
    }

    private boolean isBypassedToday(String packageName) {

        return prefs.getBoolean(
                FocusModePrefs.KEY_BYPASS_PREFIX
                        + todayKey()
                        + "_"
                        + packageName,
                false
        );
    }

    private boolean isProtectedToday(String packageName) {

        return prefs.getBoolean(
                FocusModePrefs.KEY_PROTECTED_PREFIX
                        + todayKey()
                        + "_"
                        + packageName,
                false
        );
    }

    private void markBypassedToday(String packageName) {

        prefs.edit()
                .putBoolean(
                        FocusModePrefs.KEY_BYPASS_PREFIX
                                + todayKey()
                                + "_"
                                + packageName,
                        true
                )
                .apply();

        Log.d(TAG, "marked bypassed package=" + packageName);
    }

    private void markProtectedToday(String packageName) {

        prefs.edit()
                .putBoolean(
                        FocusModePrefs.KEY_PROTECTED_PREFIX
                                + todayKey()
                                + "_"
                                + packageName,
                        true
                )
                .apply();

        Log.d(TAG, "marked protected package=" + packageName);
    }

    private String todayKey() {

        return new SimpleDateFormat(
                "yyyy-MM-dd",
                Locale.US
        ).format(Calendar.getInstance().getTime());
    }

    private Notification buildNotification() {

        Intent launch =
                getPackageManager()
                        .getLaunchIntentForPackage(
                                getPackageName()
                        );

        PendingIntent pi =
                PendingIntent.getActivity(
                        this,
                        0,
                        launch,
                        PendingIntent.FLAG_UPDATE_CURRENT
                                | PendingIntent.FLAG_IMMUTABLE
                );

        return new Notification.Builder(
                this,
                CHANNEL_ID
        )
                .setSmallIcon(
                        getApplicationInfo().icon
                )
                .setContentTitle(
                        "Unlure is active"
                )
                .setContentText(
                        "Watching your focus limits"
                )
                .setOngoing(true)
                .setContentIntent(pi)
                .build();
    }

    private void createNotificationChannel() {

        if (Build.VERSION.SDK_INT <
                Build.VERSION_CODES.O) return;

        NotificationChannel channel =
                new NotificationChannel(
                        CHANNEL_ID,
                        "Focus",
                        NotificationManager.IMPORTANCE_LOW
                );

        NotificationManager nm =
                (NotificationManager)
                        getSystemService(
                                NOTIFICATION_SERVICE
                        );

        nm.createNotificationChannel(channel);
    }

    private GradientDrawable makeSheetBackground() {

        GradientDrawable d =
                new GradientDrawable(
                        GradientDrawable.Orientation.TOP_BOTTOM,
                        new int[]{
                                Color.argb(248, 30, 38, 50),
                                Color.argb(248, 18, 24, 34)
                        }
                );

        d.setCornerRadii(
                new float[]{
                        dp(28), dp(28),
                        dp(28), dp(28),
                        0, 0,
                        0, 0
                }
        );

        d.setStroke(
                dp(1),
                Color.argb(100, 90, 100, 120)
        );

        return d;
    }

    private GradientDrawable makeRoundedDrawable(
            int color,
            int radius
    ) {

        GradientDrawable d =
                new GradientDrawable();

        d.setColor(color);

        d.setCornerRadius(radius);

        return d;
    }

    private GradientDrawable makeStrokeDrawable(
            int color,
            int strokeColor,
            int radius
    ) {

        GradientDrawable d =
                makeRoundedDrawable(color, radius);

        d.setStroke(dp(1), strokeColor);

        return d;
    }

    private int dp(int v) {

        return Math.round(
                v * getResources()
                        .getDisplayMetrics()
                        .density
        );
    }
}
