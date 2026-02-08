package com.unlure;

import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
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

public class UsageModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "UsageDailyPrefs";
    private static final String PREFS_KEY = "daily_usage_json";
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

    @ReactMethod
    public void storeTodayStats(Promise promise) {
        UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext().getSystemService(Context.USAGE_STATS_SERVICE);
        PackageManager pm = getReactApplicationContext().getPackageManager();

        Calendar calendar = Calendar.getInstance();
        long endTime = calendar.getTimeInMillis();
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        long startTime = calendar.getTimeInMillis();

        java.util.Map<String, UsageStats> statsMap = usm.queryAndAggregateUsageStats(startTime, endTime);

        HashMap<String, Long> appTotals = new HashMap<>();
        if (statsMap != null) {
            for (UsageStats usageStats : statsMap.values()) {
                if (usageStats.getTotalTimeInForeground() > 0 && pm.getLaunchIntentForPackage(usageStats.getPackageName()) != null) {
                    appTotals.put(usageStats.getPackageName(), usageStats.getTotalTimeInForeground());
                }
            }
        }

        String dateKey = new SimpleDateFormat(DATE_FORMAT, Locale.US).format(Calendar.getInstance().getTime());
        SharedPreferences prefs = getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String existing = prefs.getString(PREFS_KEY, "{}");

        try {
            JSONObject root = new JSONObject(existing);
            JSONObject day = new JSONObject();
            for (Map.Entry<String, Long> entry : appTotals.entrySet()) {
                day.put(entry.getKey(), entry.getValue());
            }
            root.put(dateKey, day);
            prefs.edit().putString(PREFS_KEY, root.toString()).apply();
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
