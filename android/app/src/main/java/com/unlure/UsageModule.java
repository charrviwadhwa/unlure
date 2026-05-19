package com.unlure;

import android.app.usage.UsageStatsManager;
import android.app.usage.UsageEvents;
import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.BroadcastReceiver;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.facebook.react.modules.core.DeviceEventManagerModule;
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
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.HashMap;
import java.util.Set;
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
    private static final String PREFS_OPEN_COUNTS_KEY = "daily_open_counts_json";
    private static final String PREFS_LAST_DATE_KEY = "last_stored_date";
    private static final String PREFS_TODAY_CHECKPOINT_KEY = "today_usage_checkpoint";
    private static final String ICON_PREFS_NAME = "UsageIconCache";
    private static final String DATE_FORMAT = "yyyy-MM-dd";
    private static final int DAILY_USAGE_RETENTION_DAYS = 180;
    private static final long ACTIVE_AT_START_LOOKBACK_MS = 2L * 60L * 60L * 1000L;
    private static final long OPEN_COUNT_DEBOUNCE_MS = 15L * 1000L;
    private BroadcastReceiver packageChangeReceiver;

    UsageModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "UsageModule";
    }

    @Override
    public void initialize() {
        super.initialize();
        registerPackageChangeReceiver();
    }

    @Override
    public void invalidate() {
        unregisterPackageChangeReceiver();
        super.invalidate();
    }

    private void registerPackageChangeReceiver() {
        if (packageChangeReceiver != null) return;
        packageChangeReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                String action = intent.getAction();
                if (
                    Intent.ACTION_PACKAGE_REMOVED.equals(action) ||
                    Intent.ACTION_PACKAGE_ADDED.equals(action) ||
                    Intent.ACTION_PACKAGE_CHANGED.equals(action)
                ) {
                    emitInstalledAppsChanged();
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_CHANGED);
        filter.addDataScheme("package");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getReactApplicationContext().registerReceiver(packageChangeReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getReactApplicationContext().registerReceiver(packageChangeReceiver, filter);
        }
    }

    private void unregisterPackageChangeReceiver() {
        if (packageChangeReceiver == null) return;
        try {
            getReactApplicationContext().unregisterReceiver(packageChangeReceiver);
        } catch (Exception ignored) {}
        packageChangeReceiver = null;
    }

    private void emitInstalledAppsChanged() {
        try {
            if (!getReactApplicationContext().hasActiveReactInstance()) return;
            getReactApplicationContext()
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("UnlureInstalledAppsChanged", null);
        } catch (Exception ignored) {}
    }

    private boolean isSelfPackage(String packageName) {
        return packageName != null && packageName.equals(getReactApplicationContext().getPackageName());
    }

    private HashSet<String> getCountableLaunchablePackages(PackageManager pm) {
        Intent launcherIntent = new Intent(Intent.ACTION_MAIN, null);
        launcherIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> launchableApps = pm.queryIntentActivities(launcherIntent, 0);
        HashSet<String> packages = new HashSet<>();

        for (ResolveInfo resolveInfo : launchableApps) {
            if (resolveInfo.activityInfo == null || resolveInfo.activityInfo.packageName == null) continue;
            String packageName = resolveInfo.activityInfo.packageName;
            if (isSelfPackage(packageName) || isSystemShellPackage(packageName)) continue;
            packages.add(packageName);
        }

        return packages;
    }

    private boolean isSystemShellPackage(String packageName) {
        if (packageName == null) return true;
        return packageName.equals("android") ||
            packageName.equals("com.android.systemui") ||
            packageName.contains("launcher") ||
            packageName.contains("permissioncontroller") ||
            packageName.contains("packageinstaller");
    }

    private boolean isInstalledLaunchablePackage(PackageManager pm, String packageName) {
        if (packageName == null || isSelfPackage(packageName) || isSystemShellPackage(packageName)) return false;
        try {
            pm.getPackageInfo(packageName, 0);
            Intent launchIntent = pm.getLaunchIntentForPackage(packageName);
            return launchIntent != null;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
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

    private String getCachedIconBase64(PackageManager pm, String packageName, ApplicationInfo appInfo) {
        try {
            PackageInfo packageInfo = pm.getPackageInfo(packageName, 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packageInfo.getLongVersionCode()
                : packageInfo.versionCode;
            String cacheKey = "icon_" + packageName + "_" + versionCode;
            SharedPreferences prefs = getReactApplicationContext()
                .getSharedPreferences(ICON_PREFS_NAME, Context.MODE_PRIVATE);
            String cached = prefs.getString(cacheKey, null);
            if (cached != null) return cached;

            Drawable icon = appInfo.loadIcon(pm);
            String encoded = drawableToBase64(icon);
            if (encoded != null) {
                prefs.edit().putString(cacheKey, encoded).apply();
            }
            return encoded;
        } catch (Exception ignored) {
            return null;
        }
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

    private UsageSnapshot queryUsageSnapshot(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        return queryUsageSnapshotFromEvents(usm, pm, startTime, endTime);
    }

    private HashMap<String, Long> queryUsageTotals(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        return queryUsageSnapshot(usm, pm, startTime, endTime).totals;
    }

    private UsageSnapshot queryUsageSnapshotFromEvents(UsageStatsManager usm, PackageManager pm, long startTime, long endTime) {
        HashMap<String, Long> totals = new HashMap<>();
        HashMap<String, Integer> openCounts = new HashMap<>();
        HashMap<String, Long> activeStarts = new HashMap<>();
        HashMap<String, Boolean> foregroundForOpenCounts = new HashMap<>();
        HashMap<String, Long> lastOpenTimes = new HashMap<>();
        Set<String> countablePackages = getCountableLaunchablePackages(pm);
        HashMap<String, Boolean> activeAtStart = getActivePackagesAtStart(usm, pm, startTime);
        long maxWindow = Math.max(endTime - startTime, 0L);

        for (String pkg : activeAtStart.keySet()) {
            activeStarts.put(pkg, startTime);
            foregroundForOpenCounts.put(pkg, true);
        }

        UsageEvents usageEvents = usm.queryEvents(startTime, endTime);
        if (usageEvents == null) return new UsageSnapshot(totals, openCounts);

        UsageEvents.Event event = new UsageEvents.Event();
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event);
            String pkg = event.getPackageName();
            if (pkg == null || !countablePackages.contains(pkg)) continue;

            int type = event.getEventType();
            long eventTime = Math.min(Math.max(event.getTimeStamp(), startTime), endTime);

            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                boolean alreadyForeground = foregroundForOpenCounts.getOrDefault(pkg, false);
                long lastOpenTime = lastOpenTimes.getOrDefault(pkg, startTime - OPEN_COUNT_DEBOUNCE_MS);
                if (!alreadyForeground && eventTime - lastOpenTime >= OPEN_COUNT_DEBOUNCE_MS) {
                    openCounts.put(pkg, openCounts.getOrDefault(pkg, 0) + 1);
                    lastOpenTimes.put(pkg, eventTime);
                }
                foregroundForOpenCounts.put(pkg, true);

                if (!activeStarts.containsKey(pkg)) {
                    activeStarts.put(pkg, eventTime);
                }
            } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND) {
                foregroundForOpenCounts.put(pkg, false);
                Long start = activeStarts.remove(pkg);
                if (start != null && eventTime > start) {
                    long delta = Math.min(eventTime - start, maxWindow);
                    if (delta > 0) {
                        long nextTotal = totals.getOrDefault(pkg, 0L) + delta;
                        totals.put(pkg, Math.min(nextTotal, maxWindow));
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
                foregroundForOpenCounts.clear();
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

        return new UsageSnapshot(totals, openCounts);
    }

    private static class UsageSnapshot {
        final HashMap<String, Long> totals;
        final HashMap<String, Integer> openCounts;

        UsageSnapshot(HashMap<String, Long> totals, HashMap<String, Integer> openCounts) {
            this.totals = totals;
            this.openCounts = openCounts;
        }
    }

    private HashMap<String, Boolean> getActivePackagesAtStart(UsageStatsManager usm, PackageManager pm, long startTime) {
        HashMap<String, Integer> lastEvents = new HashMap<>();
        Set<String> countablePackages = getCountableLaunchablePackages(pm);
        long lookbackStart = startTime - ACTIVE_AT_START_LOOKBACK_MS;
        UsageEvents previousEvents = usm.queryEvents(lookbackStart, startTime);
        if (previousEvents == null) return new HashMap<>();

        UsageEvents.Event event = new UsageEvents.Event();
        while (previousEvents.hasNextEvent()) {
            previousEvents.getNextEvent(event);
            String pkg = event.getPackageName();
            if (pkg == null || !countablePackages.contains(pkg)) continue;

            int type = event.getEventType();
            if (
                type == UsageEvents.Event.MOVE_TO_FOREGROUND ||
                type == UsageEvents.Event.MOVE_TO_BACKGROUND ||
                type == UsageEvents.Event.DEVICE_SHUTDOWN ||
                type == UsageEvents.Event.DEVICE_STARTUP
            ) {
                lastEvents.put(pkg, type);
            }
        }

        HashMap<String, Boolean> active = new HashMap<>();
        for (Map.Entry<String, Integer> entry : lastEvents.entrySet()) {
            int type = entry.getValue();
            if (type == UsageEvents.Event.MOVE_TO_FOREGROUND) {
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
        String existingOpenCounts = prefs.getString(PREFS_OPEN_COUNTS_KEY, "{}");
        String lastStoredDate = prefs.getString(PREFS_LAST_DATE_KEY, null);

        try {
            JSONObject root = new JSONObject(existing);
            JSONObject openRoot = new JSONObject(existingOpenCounts);
            root = pruneOldDailyStats(root, startOfToday, sdf);
            openRoot = pruneOldDailyStats(openRoot, startOfToday, sdf);

            if (lastStoredDate == null || !lastStoredDate.equals(todayKey)) {
                Calendar startOfYesterday = (Calendar) startOfToday.clone();
                startOfYesterday.add(Calendar.DATE, -1);
                long yStart = startOfYesterday.getTimeInMillis();
                long yEnd = startTime;
                String yesterdayKey = sdf.format(startOfYesterday.getTime());

                UsageSnapshot yesterdaySnapshot = queryUsageSnapshot(usm, pm, yStart, yEnd);
                JSONObject yDay = new JSONObject();
                JSONObject yOpenDay = new JSONObject();
                for (Map.Entry<String, Long> entry : yesterdaySnapshot.totals.entrySet()) {
                    yDay.put(entry.getKey(), entry.getValue());
                }
                for (Map.Entry<String, Integer> entry : yesterdaySnapshot.openCounts.entrySet()) {
                    yOpenDay.put(entry.getKey(), entry.getValue());
                }
                root.put(yesterdayKey, yDay);
                openRoot.put(yesterdayKey, yOpenDay);
            }

            long checkpoint = prefs.getLong(PREFS_TODAY_CHECKPOINT_KEY, startTime);
            boolean canUseCheckpoint = todayKey.equals(lastStoredDate) && checkpoint >= startTime && checkpoint < endTime;
            long queryStart = canUseCheckpoint ? checkpoint : startTime;
            UsageSnapshot todaySnapshot = queryUsageSnapshot(usm, pm, queryStart, endTime);
            JSONObject day = canUseCheckpoint && root.has(todayKey)
                ? root.getJSONObject(todayKey)
                : new JSONObject();
            for (Map.Entry<String, Long> entry : todaySnapshot.totals.entrySet()) {
                long previous = canUseCheckpoint ? day.optLong(entry.getKey(), 0L) : 0L;
                day.put(entry.getKey(), previous + entry.getValue());
            }

            UsageSnapshot todayOpenSnapshot = canUseCheckpoint
                ? queryUsageSnapshot(usm, pm, startTime, endTime)
                : todaySnapshot;
            JSONObject openDay = new JSONObject();
            for (Map.Entry<String, Integer> entry : todayOpenSnapshot.openCounts.entrySet()) {
                openDay.put(entry.getKey(), entry.getValue());
            }
            root.put(todayKey, day);
            openRoot.put(todayKey, openDay);
            prefs.edit()
                .putString(PREFS_KEY, root.toString())
                .putString(PREFS_OPEN_COUNTS_KEY, openRoot.toString())
                .putString(PREFS_LAST_DATE_KEY, todayKey)
                .putLong(PREFS_TODAY_CHECKPOINT_KEY, endTime)
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
    public void getStoredDailyOpenCounts(Promise promise) {
        SharedPreferences prefs = getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String existing = prefs.getString(PREFS_OPEN_COUNTS_KEY, "{}");
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
                    dayMap.putInt(pkg, day.getInt(pkg));
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
        String protectedPrefix = FocusModePrefs.KEY_PROTECTED_PREFIX + todayKey + "_";
        String bypassPrefix = FocusModePrefs.KEY_BYPASS_PREFIX + todayKey + "_";

        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
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
    public void getWeeklyUsageInsights(Promise promise) {
        try {
            UsageStatsManager usm = (UsageStatsManager) getReactApplicationContext().getSystemService(Context.USAGE_STATS_SERVICE);
            PackageManager pm = getReactApplicationContext().getPackageManager();
            Set<String> countablePackages = getCountableLaunchablePackages(pm);
            Calendar today = Calendar.getInstance();
            today.set(Calendar.HOUR_OF_DAY, 0);
            today.set(Calendar.MINUTE, 0);
            today.set(Calendar.SECOND, 0);
            today.set(Calendar.MILLISECOND, 0);

            HashMap<String, Integer> firstOpenCounts = new HashMap<>();

            for (int i = 6; i >= 0; i--) {
                Calendar day = (Calendar) today.clone();
                day.add(Calendar.DATE, -i);
                long dayStart = day.getTimeInMillis();
                Calendar dayEndCal = (Calendar) day.clone();
                dayEndCal.add(Calendar.DATE, 1);
                long dayEnd = Math.min(dayEndCal.getTimeInMillis(), System.currentTimeMillis());

                UsageEvents firstEvents = usm.queryEvents(dayStart, dayEnd);
                if (firstEvents != null) {
                    UsageEvents.Event event = new UsageEvents.Event();
                    while (firstEvents.hasNextEvent()) {
                        firstEvents.getNextEvent(event);
                        String pkg = event.getPackageName();
                        if (pkg == null || !countablePackages.contains(pkg)) continue;
                        if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                            firstOpenCounts.put(pkg, firstOpenCounts.getOrDefault(pkg, 0) + 1);
                            break;
                        }
                    }
                }
            }

            WritableMap firstOpenMap = Arguments.createMap();
            for (Map.Entry<String, Integer> entry : firstOpenCounts.entrySet()) {
                firstOpenMap.putInt(entry.getKey(), entry.getValue());
            }

            WritableMap result = Arguments.createMap();
            result.putMap("firstOpenCounts", firstOpenMap);
            promise.resolve(result);
        } catch (Exception e) {
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
    public void syncFocusModeConfig(ReadableMap limits, ReadableMap names, String focusGoal, Promise promise) {
        try {
            JSONObject limitsJson = new JSONObject();
            ReadableMapKeySetIterator limitKeys = limits.keySetIterator();
            while (limitKeys.hasNextKey()) {
                String key = limitKeys.nextKey();
                int minutes = limits.getInt(key);
                if (minutes > 0) limitsJson.put(key, minutes);
            }
            android.util.Log.d("FocusMode", "syncFocusModeConfig limits=" + limitsJson);

            JSONObject namesJson = new JSONObject();
            ReadableMapKeySetIterator nameKeys = names.keySetIterator();
            while (nameKeys.hasNextKey()) {
                String key = nameKeys.nextKey();
                namesJson.put(key, names.getString(key));
            }

            SharedPreferences prefs = getReactApplicationContext()
                .getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
            JSONObject previousLimits = new JSONObject(
                prefs.getString(FocusModePrefs.KEY_LIMITS_JSON, "{}")
            );
            SharedPreferences.Editor editor = prefs.edit()
                .putString(FocusModePrefs.KEY_LIMITS_JSON, limitsJson.toString())
                .putString(FocusModePrefs.KEY_NAMES_JSON, namesJson.toString())
                .putString(FocusModePrefs.KEY_FOCUS_GOAL, focusGoal == null ? "" : focusGoal.trim());

            SimpleDateFormat sdf = new SimpleDateFormat(DATE_FORMAT, Locale.US);
            sdf.setTimeZone(TimeZone.getDefault());
            String todayKey = sdf.format(Calendar.getInstance().getTime());
            String protectedPrefix = FocusModePrefs.KEY_PROTECTED_PREFIX + todayKey + "_";
            String bypassPrefix = FocusModePrefs.KEY_BYPASS_PREFIX + todayKey + "_";
            for (String key : prefs.getAll().keySet()) {
                String packageName = null;
                if (key.startsWith(protectedPrefix)) {
                    packageName = key.substring(protectedPrefix.length());
                } else if (key.startsWith(bypassPrefix)) {
                    packageName = key.substring(bypassPrefix.length());
                }

                if (packageName == null) continue;

                int previousLimit = previousLimits.optInt(packageName, 0);
                int nextLimit = limitsJson.optInt(packageName, 0);
                if (previousLimit != nextLimit) {
                    editor.remove(key);
                }
            }

            editor.apply();
            updatePrivacyFocusMonitor(limitsJson.length() > 0);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private void updatePrivacyFocusMonitor(boolean hasLimits) {
        Context context = getReactApplicationContext();
        Intent intent = new Intent(context, FocusMonitorService.class);
        if (!hasLimits) {
            try {
                context.stopService(intent);
            } catch (Exception ignored) {}
            return;
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception e) {
            android.util.Log.w("FocusMode", "Unable to start privacy focus monitor", e);
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
                if (!isInstalledLaunchablePackage(pm, packageName)) continue;
                if (seenPackages.contains(packageName)) continue;
                seenPackages.add(packageName);

                ApplicationInfo appInfo = resolveInfo.activityInfo.applicationInfo;
                WritableMap map = Arguments.createMap();
                map.putString("appName", resolveInfo.loadLabel(pm).toString());
                map.putString("packageName", packageName);
                String iconBase64 = getCachedIconBase64(pm, packageName, appInfo);
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
