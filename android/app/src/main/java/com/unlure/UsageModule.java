package com.unlure;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.app.usage.UsageEvents;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
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
import java.util.ArrayList;
import android.content.SharedPreferences;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;
import org.json.JSONException;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;

public class UsageModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "UsageDailyPrefs";
    private static final String PREFS_KEY = "daily_usage_json";
    private static final String PREFS_LAST_DATE_KEY = "last_stored_date";
    private static final String DATE_FORMAT = "yyyy-MM-dd";

    UsageModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "UsageModule";
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

    // queryAndAggregate is more accurate for "Today" than a standard list query
    java.util.Map<String, UsageStats> statsMap = usm.queryAndAggregateUsageStats(startTime, endTime);
    
    WritableArray array = Arguments.createArray();
    if (statsMap != null) {
        for (UsageStats usageStats : statsMap.values()) {
            if (usageStats.getTotalTimeInForeground() > 0 && pm.getLaunchIntentForPackage(usageStats.getPackageName()) != null) {
                WritableMap map = Arguments.createMap();
                map.putString("id", usageStats.getPackageName());
                map.putDouble("totalTime", (double) usageStats.getTotalTimeInForeground());
                array.pushMap(map);
            }
        }
    }
    promise.resolve(array);
}

    private HashMap<String, Long> queryUsageTotals(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        HashMap<String, Long> fromEvents = queryUsageTotalsFromEvents(usm, pm, startTime, endTime);
        if (!fromEvents.isEmpty()) return fromEvents;

        java.util.Map<String, UsageStats> statsMap = usm.queryAndAggregateUsageStats(startTime, endTime);
        HashMap<String, Long> appTotals = new HashMap<>();
        if (statsMap != null) {
            for (UsageStats usageStats : statsMap.values()) {
                if (usageStats.getTotalTimeInForeground() > 0 && pm.getLaunchIntentForPackage(usageStats.getPackageName()) != null) {
                    appTotals.put(usageStats.getPackageName(), usageStats.getTotalTimeInForeground());
                }
            }
        }
        return appTotals;
    }

    private HashMap<String, Long> queryUsageTotalsFromEvents(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        HashMap<String, Long> totals = new HashMap<>();
        HashMap<String, Long> lastStart = new HashMap<>();

        UsageEvents usageEvents = usm.queryEvents(startTime, endTime);
        UsageEvents.Event event = new UsageEvents.Event();
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event);
            String pkg = event.getPackageName();
            if (pkg == null || pm.getLaunchIntentForPackage(pkg) == null) continue;

            int type = event.getEventType();
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                lastStart.put(pkg, event.getTimeStamp());
            } else if (
                type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                type == UsageEvents.Event.ACTIVITY_PAUSED ||
                type == UsageEvents.Event.ACTIVITY_STOPPED
            ) {
                Long start = lastStart.remove(pkg);
                if (start != null && event.getTimeStamp() > start) {
                    long delta = event.getTimeStamp() - start;
                    totals.put(pkg, totals.getOrDefault(pkg, 0L) + delta);
                }
            }
        }

        for (Map.Entry<String, Long> entry : lastStart.entrySet()) {
            long start = entry.getValue();
            if (endTime > start) {
                totals.put(entry.getKey(), totals.getOrDefault(entry.getKey(), 0L) + (endTime - start));
            }
        }

        return totals;
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
    public void openSettings() {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(intent);
    }

    @ReactMethod
public void getInstalledApps(Promise promise) {
    // Run this on a background thread to prevent UI freezing
    new Thread(() -> {
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            // Fetching just basic info first is faster
            List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
            WritableArray appList = Arguments.createArray();

            for (ApplicationInfo appInfo : packages) {
                // 🚨 OPTIMIZATION: Only process apps that a user can actually launch
                if (pm.getLaunchIntentForPackage(appInfo.packageName) != null) {
                    WritableMap map = Arguments.createMap();
                    map.putString("appName", appInfo.loadLabel(pm).toString());
                    map.putString("packageName", appInfo.packageName);
                    appList.pushMap(map);
                }
            }
            promise.resolve(appList);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }).start();
}
}
