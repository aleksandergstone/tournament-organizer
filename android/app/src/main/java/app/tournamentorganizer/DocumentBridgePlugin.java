package app.tournamentorganizer;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * The phone half of the desktop file bridge.
 *
 * The renderer talks to the same `window.toDesktop` contract it uses on the
 * desktop (see src/engine/desktop.ts), so the screens need no Android-specific
 * code: print and PDF go through Android's own print dialog — where "Save as
 * PDF" is one tap — and project/CSV files go through the system file picker.
 * Nothing is uploaded anywhere: the documents are rendered on this device.
 */
@CapacitorPlugin(name = "DocumentBridge")
public class DocumentBridgePlugin extends Plugin {

    /** Prints a self-contained HTML document through the Android print dialog. */
    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html", "");
        final String jobName = call.getString("jobName", "Document");
        if (html.isEmpty()) {
            call.reject("No document to print.");
            return;
        }
        getActivity().runOnUiThread(() -> printDocument(call, html, jobName));
    }

    /**
     * A PDF cannot be written from a page, so this is the same print dialog as
     * printHtml — the organizer picks "Save as PDF", exactly as on a laptop with
     * no PDF writer installed.
     */
    @PluginMethod
    public void savePdf(final PluginCall call) {
        final String html = call.getString("html", "");
        final String filename = call.getString("filename", "document.pdf");
        if (html.isEmpty()) {
            call.reject("No document to save.");
            return;
        }
        getActivity().runOnUiThread(() -> printDocument(call, html, jobNameFor(filename)));
    }

    private String jobNameFor(String filename) {
        String base = filename.replaceAll("\\.[A-Za-z0-9]+$", "");
        return base.isEmpty() ? "Document" : base;
    }
    private void printDocument(final PluginCall call, final String html, final String jobName) {
        try {
            final ViewGroup root = (ViewGroup) getBridge().getWebView().getParent();
            // The print adapter measures the page it is given, so the WebView
            // needs a real screen-sized layout even though nobody sees it.
            final WebView printer = new WebView(getContext());
            printer.getSettings().setJavaScriptEnabled(false);
            printer.setAlpha(0f);
            root.addView(printer, new ViewGroup.LayoutParams(
                    getContext().getResources().getDisplayMetrics().widthPixels,
                    getContext().getResources().getDisplayMetrics().heightPixels));
            printer.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    try {
                        PrintManager pm = (PrintManager) getContext()
                                .getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                        PrintAttributes attributes = new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                .build();
                        pm.print(jobName, adapter, attributes);
                        JSObject result = new JSObject();
                        result.put("ok", true);
                        call.resolve(result);
                    } catch (Exception e) {
                        call.reject("Printing is not available on this device: " + e.getMessage());
                    } finally {
                        root.removeView(view);
                    }
                }
            });
            printer.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        } catch (Exception e) {
            call.reject("Printing is not available on this device: " + e.getMessage());
        }
    }

    /** Saves a text file (project backup, CSV) wherever the organizer picks. */
    @PluginMethod
    public void saveText(PluginCall call) {
        String mime = call.getString("mime", "text/plain");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "export.txt"));
        startActivityForResult(call, intent, "saveTextResult");
    }

    @ActivityCallback
    private void saveTextResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject response = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            response.put("canceled", true);
            call.resolve(response);
            return;
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
            out.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            response.put("error", "Could not write the file: " + e.getMessage());
            call.resolve(response);
            return;
        }
        response.put("path", call.getString("filename", ""));
        call.resolve(response);
    }

    /** Opens a project backup from the device. */
    @PluginMethod
    public void openText(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "openTextResult");
    }

    @ActivityCallback
    private void openTextResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        JSObject response = new JSObject();
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            response.put("canceled", true);
            call.resolve(response);
            return;
        }
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) {
                throw new IllegalStateException("the file could not be opened");
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = in.read(chunk)) > 0) {
                buffer.write(chunk, 0, read);
            }
            response.put("path", displayName(uri));
            response.put("text", new String(buffer.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            response.put("error", "Could not read the file: " + e.getMessage());
        }
        call.resolve(response);
    }

    private String displayName(Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null) {
            return "";
        }
        int slash = name.lastIndexOf('/');
        return slash >= 0 ? name.substring(slash + 1) : name;
    }
}
