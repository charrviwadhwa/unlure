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

public class UsageModule extends ReactContextBaseJavaModule {
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
    
    Calendar calendar = Calendar.getInstance();
    long endTime = calendar.getTimeInMillis();
    calendar.set(Calendar.HOUR_OF_DAY, 0);
    calendar.set(Calendar.MINUTE, 0);
    calendar.set(Calendar.SECOND, 0);
    calendar.set(Calendar.MILLISECOND, 0);
    long startTime = calendar.getTimeInMillis();

    // 🚨 USE AGGREGATE INSTEAD OF LIST
    java.util.Map<String, UsageStats> statsMap = usm.queryAndAggregateUsageStats(startTime, endTime);
    
    WritableArray array = Arguments.createArray();
    if (statsMap != null) {
        for (UsageStats usageStats : statsMap.values()) {
            String pkg = usageStats.getPackageName();
            if (usageStats.getTotalTimeInForeground() > 0 && pm.getLaunchIntentForPackage(pkg) != null) {
                WritableMap map = Arguments.createMap();
                map.putString("id", pkg);
                map.putDouble("totalTime", (double) usageStats.getTotalTimeInForeground());
                array.pushMap(map);
            }
        }
    }
    promise.resolve(array);
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