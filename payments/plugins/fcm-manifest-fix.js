// Expo config plugin to resolve AndroidManifest meta-data conflicts between
// expo-notifications and @react-native-firebase/messaging by explicitly
// setting meta-data with tools:replace on the application node.
const { withAndroidManifest } = require('@expo/config-plugins');

function ensureToolsNamespace(manifest) {
    if (!manifest.manifest.$) manifest.manifest.$ = {};
    if (!manifest.manifest.$['xmlns:tools']) {
        manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
}

function upsertMeta(app, name, attrs) {
    if (!app['meta-data']) app['meta-data'] = [];
    // Remove existing entries for this name to prevent duplicates
    app['meta-data'] = app['meta-data'].filter((m) => !(m.$ && m.$['android:name'] === name));
    app['meta-data'].push({ $: { 'android:name': name, ...attrs } });
}

module.exports = function withFcmManifestFix(config, props = {}) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults;
        ensureToolsNamespace(manifest);
        const app = manifest.manifest.application && manifest.manifest.application[0];
        if (!app) return config;

        const channelId = props.channelId || 'default';
        const color = props.color || '@color/notification_icon_color';

        // Set/override default notification channel id
        upsertMeta(app,
            'com.google.firebase.messaging.default_notification_channel_id',
            {
                'android:value': channelId,
                'tools:replace': 'android:value',
            }
        );

        // Set/override default notification color
        upsertMeta(app,
            'com.google.firebase.messaging.default_notification_color',
            {
                'android:resource': color,
                'tools:replace': 'android:resource',
            }
        );

        return config;
    });
};
