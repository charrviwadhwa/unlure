package com.unlure;

import android.app.usage.UsageStatsManager;
import android.app.usage.UsageEvents;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableMapKeySetIterator;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import java.util.List;
import java.util.Calendar;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.json.JSONException;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.util.Base64;
import java.io.ByteArrayOutputStream;

public class UsageModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "UsageDailyPrefs";
    private static final String PREFS_KEY = "daily_usage_json";
    private static final String PREFS_LAST_DATE_KEY = "last_stored_date";
    private static final String DATE_FORMAT = "yyyy-MM-dd";
    private static final int DAILY_USAGE_RETENTION_DAYS = 180;

    UsageModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "UsageModule";
    }

    private String drawableToBase64(Drawable drawable) {
        try {
            Bitmap bitmap;
            if (drawable instanceof BitmapDrawable) {
                Bitmap source = ((BitmapDrawable) drawable).getBitmap();
                if (source == null) return null;
                bitmap = Bitmap.createScaledBitmap(source, 96, 96, true);
            } else {
                bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                drawable.draw(canvas);
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, baos);
            byte[] bytes = baos.toByteArray();
            return Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (Exception ignored) {
            return null;
        }
    }

    @ReactMethod
public void getDailyStats(Promise promise) {
    UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext().getSystemService(Context.USAGE_STATS_SERVICE);
    PackageManager pm = getReactApplicationContext().getPackageManager();
    
    // 🚨 RESET CALENDAR TO EXACT MIDNIGHT TODAY
    Calendar calendar = Calendar.getInstance();
    long endTime = calendar.getTimeInMillis();
    
    calendar.set(Calendar.HOUR_OF_DAY, 0);
    calendar.set(Calendar.MINUTE, 0);
    calendar.set(Calendar.SECOND, 0);
    calendar.set(Calendar.MILLISECOND, 0);
    long startTime = calendar.getTimeInMillis();

    HashMap<String, Long> appTotals = queryUsageTotals(usm, pm, startTime, endTime);
    WritableArray array = Arguments.createArray();
    for (Map.Entry<String, Long> entry : appTotals.entrySet()) {
        if (entry.getValue() > 0) {
            WritableMap map = Arguments.createMap();
            map.putString("id", entry.getKey());
            map.putDouble("totalTime", (double) entry.getValue());
            array.pushMap(map);
        }
    }
    promise.resolve(array);
}

    private HashMap<String, Long> queryUsageTotals(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        return queryUsageTotalsFromEvents(usm, pm, startTime, endTime);
    }

    private HashMap<String, Long> queryUsageTotalsFromEvents(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        HashMap<String, Long> totals = new HashMap<>();
        HashMap<String, Long> activeStarts = new HashMap<>();
        HashMap<String, Integer> openActivityCounts = new HashMap<>();
        HashMap<String, Boolean> activeAtStart = getActivePackagesAtStart(usm, pm, startTime);
        long maxWindow = Math.max(endTime - startTime, 0L);

        for (String pkg : activeAtStart.keySet()) {
            activeStarts.put(pkg, startTime);
            openActivityCounts.put(pkg, 1);
        }

        UsageEvents usageEvents = usm.queryEvents(startTime, endTime);
        if (usageEvents == null) return totals;

        UsageEvents.Event event = new UsageEvents.Event();
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event);
            String pkg = event.getPackageName();
            if (pkg == null || pm.getLaunchIntentForPackage(pkg) == null) continue;

            int type = event.getEventType();
            long eventTime = Math.min(Math.max(event.getTimeStamp(), startTime), endTime);

            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                int currentOpen = openActivityCounts.getOrDefault(pkg, 0);
                if (currentOpen == 0) {
                    activeStarts.put(pkg, eventTime);
                }
                openActivityCounts.put(pkg, currentOpen + 1);
            } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND || type == UsageEvents.Event.ACTIVITY_PAUSED) {
                int currentOpen = openActivityCounts.getOrDefault(pkg, 0);
                if (currentOpen > 0) {
                    currentOpen -= 1;
                    openActivityCounts.put(pkg, currentOpen);
                }

                if (currentOpen == 0) {
                    Long start = activeStarts.remove(pkg);
                    if (start != null && eventTime > start) {
                        long delta = Math.min(eventTime - start, maxWindow);
                        if (delta > 0) {
                            long nextTotal = totals.getOrDefault(pkg, 0L) + delta;
                            totals.put(pkg, Math.min(nextTotal, maxWindow));
                        }
                    }
                }
            } else if (type == UsageEvents.Event.ACTIVITY_STOPPED) {
                if (openActivityCounts.getOrDefault(pkg, 0) == 0) {
                    Long start = activeStarts.remove(pkg);
                    if (start != null && eventTime > start) {
                        long delta = Math.min(eventTime - start, maxWindow);
                        if (delta > 0) {
                            long nextTotal = totals.getOrDefault(pkg, 0L) + delta;
                            totals.put(pkg, Math.min(nextTotal, maxWindow));
                        }
                    }
                }
            } else if (type == UsageEvents.Event.DEVICE_SHUTDOWN || type == UsageEvents.Event.DEVICE_STARTUP) {
                for (Map.Entry<String, Long> entry : activeStarts.entrySet()) {
                    String activePkg = entry.getKey();
                    long start = entry.getValue();
                    if (eventTime > start) {
                        long delta = Math.min(eventTime - start, maxWindow);
                        long nextTotal = totals.getOrDefault(activePkg, 0L) + delta;
                        totals.put(activePkg, Math.min(nextTotal, maxWindow));
                    }
                }
                activeStarts.clear();
                openActivityCounts.clear();
            }
        }

        for (Map.Entry<String, Long> entry : activeStarts.entrySet()) {
            String pkg = entry.getKey();
            long start = entry.getValue();
            if (endTime > start) {
                long delta = Math.min(endTime - start, maxWindow);
                if (delta > 0) {
                    long nextTotal = totals.getOrDefault(pkg, 0L) + delta;
                    totals.put(pkg, Math.min(nextTotal, maxWindow));
                }
            }
        }

        return totals;
    }

    private HashMap<String, Boolean> getActivePackagesAtStart(UsageStatsManager usm, PackageManager pm, long startTime) {
        HashMap<String, Integer> lastEvents = new HashMap<>();
        long lookbackStart = startTime - (12L * 60L * 60L * 1000L);
        UsageEvents previousEvents = usm.queryEvents(lookbackStart, startTime);
        if (previousEvents == null) return new HashMap<>();

        UsageEvents.Event event = new UsageEvents.Event();
        while (previousEvents.hasNextEvent()) {
            previousEvents.getNextEvent(event);
            String pkg = event.getPackageName();
            if (pkg == null || pm.getLaunchIntentForPackage(pkg) == null) continue;

            int type = event.getEventType();
            if (
                type == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                type == UsageEvents.Event.ACTIVITY_RESUMED ||
                type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                type == UsageEvents.Event.ACTIVITY_PAUSED ||
                type == UsageEvents.Event.ACTIVITY_STOPPED ||
                type == UsageEvents.Event.DEVICE_SHUTDOWN ||
                type == UsageEvents.Event.DEVICE_STARTUP
            ) {
                lastEvents.put(pkg, type);
            }
        }

        HashMap<String, Boolean> active = new HashMap<>();
        for (Map.Entry<String, Integer> entry : lastEvents.entrySet()) {
            int type = entry.getValue();
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                active.put(entry.getKey(), true);
            }
        }
        return active;
    }

    private JSONObject pruneOldDailyStats(JSONObject root, Calendar startOfToday, SimpleDateFormat sdf) throws JSONException {
        Calendar cutoff = (Calendar) startOfToday.clone();
        cutoff.add(Calendar.DATE, -DAILY_USAGE_RETENTION_DAYS);
        cutoff.set(Calendar.HOUR_OF_DAY, 0);
        cutoff.set(Calendar.MINUTE, 0);
        cutoff.set(Calendar.SECOND, 0);
        cutoff.set(Calendar.MILLISECOND, 0);
        long cutoffMs = cutoff.getTimeInMillis();

        JSONObject pruned = new JSONObject();
        java.util.Iterator<String> keys = root.keys();
        while (keys.hasNext()) {
            String dateKey = keys.next();
            try {
                Calendar parsed = Calendar.getInstance();
                parsed.setTime(sdf.parse(dateKey));
                parsed.set(Calendar.HOUR_OF_DAY, 0);
                parsed.set(Calendar.MINUTE, 0);
                parsed.set(Calendar.SECOND, 0);
                parsed.set(Calendar.MILLISECOND, 0);
                if (parsed.getTimeInMillis() >= cutoffMs) {
                    pruned.put(dateKey, root.getJSONObject(dateKey));
                }
            } catch (Exception ignored) {}
        }
        return pruned;
    }

    @ReactMethod
    public void storeTodayStats(Promise promise) {
        UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext().getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getReactApplicationContext().getPackageManager();

        Calendar now = Calendar.getInstance();
        long endTime = now.getTimeInMillis();
        Calendar startOfToday = (Calendar) now.clone();
        startOfToday.set(Calendar.HOUR_OF_DAY, 0);
        startOfToday.set(Calendar.MINUTE, 0);
        startOfToday.set(Calendar.SECOND, 0);
        startOfToday.set(Calendar.MILLISECOND, 0);
        long startTime = startOfToday.getTimeInMillis();

        SimpleDateFormat sdf = new SimpleDateFormat(DATE_FORMAT, Locale.US);
        sdf.setTimeZone(TimeZone.getDefault());

        String todayKey = sdf.format(startOfToday.getTime());
        SharedPreferences prefs = getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String existing = prefs.getString(PREFS_KEY, "{}");
        String lastStoredDate = prefs.getString(PREFS_LAST_DATE_KEY, null);

        try {
            JSONObject root = new JSONObject(existing);
            root = pruneOldDailyStats(root, startOfToday, sdf);

            if (lastStoredDate == null || !lastStoredDate.equals(todayKey)) {
                Calendar startOfYesterday = (Calendar) startOfToday.clone();
                startOfYesterday.add(Calendar.DATE, -1);
                long yStart = startOfYesterday.getTimeInMillis();
                long yEnd = startTime;
                String yesterdayKey = sdf.format(startOfYesterday.getTime());

                HashMap<String, Long> yesterdayTotals = queryUsageTotals(usm, pm, yStart, yEnd);
                JSONObject yDay = new JSONObject();
                for (Map.Entry<String, Long> entry : yesterdayTotals.entrySet()) {
                    yDay.put(entry.getKey(), entry.getValue());
                }
                root.put(yesterdayKey, yDay);
            }

            HashMap<String, Long> todayTotals = queryUsageTotals(usm, pm, startTime, endTime);
            JSONObject day = new JSONObject();
            for (Map.Entry<String, Long> entry : todayTotals.entrySet()) {
                day.put(entry.getKey(), entry.getValue());
            }
            root.put(todayKey, day);
            prefs.edit()
                .putString(PREFS_KEY, root.toString())
                .putString(PREFS_LAST_DATE_KEY, todayKey)
                .apply();
            promise.resolve(true);
        } catch (JSONException e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getStoredDailyStats(Promise promise) {
        SharedPreferences prefs = getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String existing = prefs.getString(PREFS_KEY, "{}");
        try {
            JSONObject root = new JSONObject(existing);
            WritableMap result = Arguments.createMap();

            java.util.Iterator<String> keys = root.keys();
            while (keys.hasNext()) {
                String dateKey = keys.next();
                JSONObject day = root.getJSONObject(dateKey);
                WritableMap dayMap = Arguments.createMap();
                java.util.Iterator<String> appKeys = day.keys();
                while (appKeys.hasNext()) {
                    String pkg = appKeys.next();
                    dayMap.putDouble(pkg, day.getLong(pkg));
                }
                result.putMap(dateKey, dayMap);
            }
            promise.resolve(result);
        } catch (JSONException e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getTodayFocusModeDecisions(Promise promise) {
        SimpleDateFormat sdf = new SimpleDateFormat(DATE_FORMAT, Locale.US);
        sdf.setTimeZone(TimeZone.getDefault());
        String todayKey = sdf.format(Calendar.getInstance().getTime());
        String protectedPrefix = FocusModeService.KEY_PROTECTED_PREFIX + todayKey + "_";
        String bypassPrefix = FocusModeService.KEY_BYPASS_PREFIX + todayKey + "_";

        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(FocusModeService.PREFS_NAME, Context.MODE_PRIVATE);
        WritableMap result = Arguments.createMap();
        WritableMap protectedApps = Arguments.createMap();
        WritableMap bypassedApps = Arguments.createMap();

        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            Object value = entry.getValue();
            if (!(value instanceof Boolean) || !((Boolean) value)) continue;

            String key = entry.getKey();
            if (key.startsWith(protectedPrefix)) {
                protectedApps.putBoolean(key.substring(protectedPrefix.length()), true);
            } else if (key.startsWith(bypassPrefix)) {
                bypassedApps.putBoolean(key.substring(bypassPrefix.length()), true);
            }
        }

        result.putMap("protectedApps", protectedApps);
        result.putMap("bypassedApps", bypassedApps);
        promise.resolve(result);
    }

    @ReactMethod
    public void openSettings() {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(intent);
    }

    @ReactMethod
    public void hasUsageAccess(Promise promise) {
        try {
            AppOpsManager appOps = (AppOpsManager) getReactApplicationContext().getSystemService(Context.APP_OPS_SERVICE);
            int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                android.os.Process.myUid(),
                getReactApplicationContext().getPackageName()
            );
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void canDrawOverlays(Promise promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            promise.resolve(true);
            return;
        }
        promise.resolve(Settings.canDrawOverlays(getReactApplicationContext()));
    }

    @ReactMethod
    public void openOverlaySettings() {
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getReactApplicationContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(fallback);
        }
    }

    @ReactMethod
    public void openAccessibilitySettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Settings.ACTION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getReactApplicationContext().startActivity(fallback);
        }
    }

    @ReactMethod
    public void isFocusModeAccessibilityEnabled(Promise promise) {
        String serviceName = getReactApplicationContext().getPackageName() + "/" + FocusModeService.class.getName();
        String enabledServices = Settings.Secure.getString(
            getReactApplicationContext().getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        );
        boolean accessibilityEnabled = Settings.Secure.getInt(
            getReactApplicationContext().getContentResolver(),
            Settings.Secure.ACCESSIBILITY_ENABLED,
            0
        ) == 1;

        if (!accessibilityEnabled || enabledServices == null) {
            promise.resolve(false);
            return;
        }

        TextUtils.SimpleStringSplitter splitter = new TextUtils.SimpleStringSplitter(':');
        splitter.setString(enabledServices);
        while (splitter.hasNext()) {
            String enabledService = splitter.next();
            if (enabledService.equalsIgnoreCase(serviceName)) {
                promise.resolve(true);
                return;
            }
        }
        promise.resolve(false);
    }

    @ReactMethod
    public void syncFocusModeConfig(ReadableMap limits, ReadableMap names, Promise promise) {
        try {
            JSONObject limitsJson = new JSONObject();
            ReadableMapKeySetIterator limitKeys = limits.keySetIterator();
            while (limitKeys.hasNextKey()) {
                String key = limitKeys.nextKey();
                int minutes = limits.getInt(key);
                if (minutes > 0) limitsJson.put(key, minutes);
            }

            JSONObject namesJson = new JSONObject();
            ReadableMapKeySetIterator nameKeys = names.keySetIterator();
            while (nameKeys.hasNextKey()) {
                String key = nameKeys.nextKey();
                namesJson.put(key, names.getString(key));
            }

            SharedPreferences prefs = getReactApplicationContext()
                .getSharedPreferences(FocusModeService.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString(FocusModeService.KEY_LIMITS_JSON, limitsJson.toString())
                .putString(FocusModeService.KEY_NAMES_JSON, namesJson.toString())
                .apply();
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
public void getInstalledApps(Promise promise) {
    // Run this on a background thread to prevent UI freezing
    new Thread(() -> {
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            // Fetching just basic info first is faster
            Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
            launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> launchableApps = pm.queryIntentActivities(launcherIntent, 0);
            HashSet<String> seenPackages = new HashSet<>();
            WritableArray appList = Arguments.createArray();

            for (ResolveInfo resolveInfo : launchableApps) {
                // 🚨 OPTIMIZATION: Only process apps that a user can actually launch
                if (resolveInfo.activityInfo == null || resolveInfo.activityInfo.packageName == null) continue;
                String packageName = resolveInfo.activityInfo.packageName;
                if (seenPackages.contains(packageName)) continue;
                seenPackages.add(packageName);

                ApplicationInfo appInfo = resolveInfo.activityInfo.applicationInfo;
                WritableMap map = Arguments.createMap();
                map.putString("appName", resolveInfo.loadLabel(pm).toString());
                map.putString("packageName", packageName);
                String iconBase64 = drawableToBase64(appInfo.loadIcon(pm));
                if (iconBase64 != null) {
                    map.putString("iconBase64", iconBase64);
                }
                appList.pushMap(map);
            }
            promise.resolve(appList);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }).start();
}
}
