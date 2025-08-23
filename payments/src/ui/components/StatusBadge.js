import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { tokens } from '../tokens';

const palette = {
    success: { bg: 'rgba(76,195,138,0.18)', fg: tokens.colors.success },
    danger: { bg: 'rgba(255,77,79,0.18)', fg: tokens.colors.danger },
    warning: { bg: 'rgba(255,176,32,0.20)', fg: tokens.colors.warning },
    info: { bg: 'rgba(59,130,246,0.20)', fg: tokens.colors.info },
    neutral: { bg: 'rgba(255,255,255,0.15)', fg: tokens.colors.textDim },
};

export function StatusBadge({ status, children, variant }) {
    const v = variant || paletteKey(status);
    const { bg, fg } = palette[v] || palette.neutral;
    return (
        <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.text, { color: fg }]}>{children || status}</Text>
        </View>
    );
}

function paletteKey(status) {
    const s = (status || '').toLowerCase();
    if (['success', 'paid', 'completed'].includes(s)) return 'success';
    if (['failed', 'rejected', 'declined'].includes(s)) return 'danger';
    if (['pending'].includes(s)) return 'warning';
    if (['processing'].includes(s)) return 'info';
    return 'neutral';
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    text: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

export default StatusBadge;
