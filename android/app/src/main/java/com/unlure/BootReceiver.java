package com.unlure;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONObject;

public class BootReceiver extends BroadcastReceiver {
    private static final String ACTION_QUICKBOOT_POWERON = "android.intent.action.QUICKBOOT_POWERON";
    private static final String ACTION_HTC_QUICKBOOT_POWERON = "com.htc.intent.action.QUICKBOOT_POWERON";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !isBootAction(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(FocusModePrefs.PREFS_NAME, Context.MODE_PRIVATE);
        String rawLimits = prefs.getString(FocusModePrefs.KEY_LIMITS_JSON, "{}");
        try {
            if (new JSONObject(rawLimits).length() <= 0) return;
        } catch (Exception ignored) {
            return;
        }

        Intent serviceIntent = new Intent(context, FocusMonitorService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }

    private boolean isBootAction(String action) {
        return Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            ACTION_QUICKBOOT_POWERON.equals(action) ||
            ACTION_HTC_QUICKBOOT_POWERON.equals(action);
    }
}
