import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { tokens } from '../tokens';

const palette = {
    success: { bg: 'rgba(76,195,138,0.18)', fg: tokens.colors.success, dotColor: '#4CAC8A' },
    danger: { bg: 'rgba(255,77,79,0.18)', fg: tokens.colors.danger, dotColor: '#FF4D4F' },
    warning: { bg: 'rgba(255,213,79,0.18)', fg: tokens.colors.warning || '#e5c558', dotColor: '#FFD54F' },
    info: { bg: 'rgba(59,130,246,0.20)', fg: tokens.colors.info, dotColor: '#3B82F6' },
    neutral: { bg: 'rgba(255,255,255,0.15)', fg: tokens.colors.textDim, dotColor: tokens.colors.textDim },
};

// Helper to get dot color based on status
function getStatusDots(status) {
    const s = (status || '').toLowerCase();
    if (s === 'pending' || s === 'submitted') {
        return { show: true, color: '#FF4D4F', hideText: true }; // Red dots for pending
    }
    if (s === 'accountant_approved') {
        return { show: true, color: '#FFD54F', hideText: true }; // Yellow dots for accountant approved
    }
    if (s === 'admin_approved') {
        return { show: true, color: '#4CAC8A', hideText: true }; // Green dots for admin approved
    }
    if (s === 'overdue') {
        return { show: true, color: '#FF4D4F', hideText: false }; // Red circle + text for overdue
    }
    return { show: false, hideText: false };
}

export function StatusBadge({ status, children, variant }) {
    const v = variant || paletteKey(status);
    const { bg, fg } = palette[v] || palette.neutral;
    const dots = getStatusDots(status);
    
    // For declined statuses, show text
    const showText = !dots.hideText;
    const isOverdue = (status || '').toLowerCase() === 'overdue';
    
    return (
        <View style={[
            styles.badge, 
            { backgroundColor: showText ? bg : 'transparent' },
            !showText && styles.badgeDotsOnly
        ]}>
            {dots.show && (
                isOverdue ? (
                    // Single circle for overdue
                    <View style={[styles.circle, { backgroundColor: dots.color }]} />
                ) : (
                    // Two dots for other statuses
                    <View style={styles.dotsContainer}>
                        <View style={[styles.dot, { backgroundColor: dots.color }]} />
                        <View style={[styles.dot, { backgroundColor: dots.color }]} />
                    </View>
                )
            )}
            {showText && <Text style={[styles.text, { color: fg }]}>{children || status}</Text>}
        </View>
    );
}

function paletteKey(status) {
    const s = (status || '').toLowerCase();
    // Treat domain-specific statuses
    if (['overdue'].includes(s)) return 'danger';
    if (['admin_approved'].includes(s)) return 'success';
    if (['declined_by_admin', 'declined_by_accountant', 'declined'].includes(s)) return 'danger';
    if (['submitted', 'accountant_approved', 'pending'].includes(s)) return 'warning';
    if (['success', 'paid', 'completed'].includes(s)) return 'success';
    if (['processing'].includes(s)) return 'info';
    return 'neutral';
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 6,
    },
    badgeDotsOnly: {
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 3,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    circle: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    text: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});

export default StatusBadge;
