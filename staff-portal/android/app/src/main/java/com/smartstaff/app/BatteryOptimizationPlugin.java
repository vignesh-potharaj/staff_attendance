package com.smartstaff.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Context context = getContext();
            String packageName = context.getPackageName();
            Intent intent = new Intent();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                    intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    ret.put("status", "requested");
                } else {
                    intent.setAction(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    ret.put("status", "opened_settings");
                }
            } else {
                ret.put("status", "not_supported");
            }
            call.resolve(ret);
        } catch (Exception e) {
            try {
                Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                ret.put("status", "fallback_opened");
                call.resolve(ret);
            } catch (Exception ex) {
                call.reject("Failed to request battery optimization prompt: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            ret.put("granted", enabled);
            ret.put("permission", enabled ? "granted" : "denied");
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("granted", false);
            ret.put("permission", "denied");
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                boolean isIgnored = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
                ret.put("isIgnored", isIgnored);
            } else {
                ret.put("isIgnored", true);
            }
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("isIgnored", false);
            call.resolve(ret);
        }
    }
}
