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
    public void get24HourStats(Promise promise) {
        UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext().getSystemService(Context.USAGE_STATS_SERVICE);
        Calendar calendar = Calendar.getInstance();
        long endTime = calendar.getTimeInMillis();
        calendar.add(Calendar.HOUR_OF_DAY, -24);
        long startTime = calendar.getTimeInMillis();

        List<UsageStats> stats = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startTime, endTime);
        
        if (stats == null || stats.isEmpty()) {
            promise.reject("NO_STATS", "No usage stats found. Check permissions.");
            return;
        }

        WritableArray array = Arguments.createArray();
        for (UsageStats usageStats : stats) {
            if (usageStats.getTotalTimeInForeground() > 0) {
                WritableMap map = Arguments.createMap();
                map.putString("packageName", usageStats.getPackageName());
                map.putDouble("totalTime", (double) usageStats.getTotalTimeInForeground());
                array.pushMap(map);
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
        try {
            PackageManager pm = getReactApplicationContext().getPackageManager();
            List<ApplicationInfo> packages = pm.getInstalledApplications(PackageManager.GET_META_DATA);
            WritableArray appList = Arguments.createArray();

            for (ApplicationInfo appInfo : packages) {
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
    }
}