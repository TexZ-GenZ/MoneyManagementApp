import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { tokens } from '../tokens';

export function SkeletonBlock({ height = 16, width = '100%', style }) {
    const opacity = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [opacity]);
    return (
        <Animated.View style={[styles.block, { height, width, opacity }, style]} />
    );
}

export function SkeletonCard({ lines = 3 }) {
    return (
        <View style={styles.card}>
            {[...Array(lines)].map((_, i) => (
                <SkeletonBlock key={i} height={14} width={i === 0 ? '55%' : i === lines - 1 ? '35%' : '80%'} style={{ marginTop: i === 0 ? 0 : 10 }} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    block: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 6,
    },
    card: {
        backgroundColor: tokens.colors.card,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: tokens.colors.border,
        marginBottom: 16,
    },
});

export default SkeletonBlock;
