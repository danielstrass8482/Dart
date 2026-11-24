package com.danielstrass.darttrainer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.appcheck.FirebaseAppCheck;

/**
 * Hands Firebase App Check tokens (Play Integrity provider, installed in
 * MainApplication) to the WebView: Capacitor.Plugins.AppCheckBridge.getToken().
 *
 * Replaces the AndroidBridge.getAppCheckToken JavascriptInterface as the
 * primary path: that interface is added in MainActivity after the WebView has
 * already started loading, and Android only exposes such objects to pages
 * loaded afterwards — so js/firebase.js could miss it at startup. Capacitor
 * plugins registered before super.onCreate() are always available.
 */
@CapacitorPlugin(name = "AppCheckBridge")
public class AppCheckBridgePlugin extends Plugin {
    @PluginMethod
    public void getToken(PluginCall call) {
        boolean forceRefresh = Boolean.TRUE.equals(call.getBoolean("forceRefresh", false));
        FirebaseAppCheck.getInstance().getAppCheckToken(forceRefresh)
                .addOnSuccessListener(result -> {
                    JSObject ret = new JSObject();
                    ret.put("token", result.getToken());
                    ret.put("expireTimeMillis", result.getExpireTimeMillis());
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName()));
    }
}
