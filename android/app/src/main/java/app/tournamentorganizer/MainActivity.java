package app.tournamentorganizer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The file/print bridge the shared renderer expects on this platform.
        registerPlugin(DocumentBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
