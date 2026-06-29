package com.danielstrass.darttrainer;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

public class MainActivity extends BridgeActivity {

    private static final int RC_SIGN_IN = 9001;
    private static final String WEB_CLIENT_ID =
            "875969093013-7mdonucr4nq4qbjdorc9e18vsg47kik6.apps.googleusercontent.com";

    private GoogleSignInClient mGoogleSignInClient;

    private void enableImmersiveMode() {
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveMode();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableImmersiveMode();

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(WEB_CLIENT_ID)
                .requestEmail()
                .build();
        mGoogleSignInClient = GoogleSignIn.getClient(this, gso);

        getBridge().getWebView().post(() -> {
            WebView webView = getBridge().getWebView();
            String ua = webView.getSettings().getUserAgentString();
            webView.getSettings().setUserAgentString(ua + " DartTrainerApp/1.0");
            webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != RC_SIGN_IN) return;

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            String idToken = account.getIdToken() != null ? account.getIdToken() : "";
            String js = "window._nativeGoogleLoginResult('" + idToken + "', null)";
            runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
        } catch (ApiException e) {
            String js = "window._nativeGoogleLoginError('Google Sign-In fehlgeschlagen: " + e.getStatusCode() + "')";
            runOnUiThread(() -> getBridge().getWebView().evaluateJavascript(js, null));
        }
    }

    class AndroidBridge {
        @JavascriptInterface
        public void startNativeLogin() {
            mGoogleSignInClient.signOut().addOnCompleteListener(MainActivity.this, task -> {
                Intent signInIntent = mGoogleSignInClient.getSignInIntent();
                startActivityForResult(signInIntent, RC_SIGN_IN);
            });
        }
    }
}
