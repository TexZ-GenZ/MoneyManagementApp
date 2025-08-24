import React from 'react';
import { View, Text } from 'react-native';
import Screen from '../../src/ui/components/Screen';
import Card from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

// Minimal legacy placeholder kept only to avoid broken deep links.
// All functionality moved to /admin/SettingsScreen. Remove this file once no links remain.
export default function GlobalSettings() {
    return (
        <Screen title="Legacy Settings" subtitle="Deprecated" scroll>
            <Card style={{ padding: 20 }}>
                <Text style={{ color: tokens.colors.textDim, fontSize: 13, fontWeight: '600', lineHeight: 20 }}>This screen is deprecated.</Text>
                <View style={{ height: 10 }} />
                <Text style={{ color: tokens.colors.textSubtle, fontSize: 12 }}>Go back and open the Admin Dashboard → Settings.</Text>
            </Card>
        </Screen>
    );
}
