import React from 'react';
import { View, StyleSheet } from 'react-native';
import { tokens, utils } from '../tokens';

export function Card({ style, children, padded = true }) {
    return (
        <View style={[styles.card, padded ? styles.padded : null, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: tokens.colors.card,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: tokens.colors.border,
    },
    padded: {
        paddingHorizontal: tokens.space.md,
        paddingVertical: tokens.space.lg,
    },
});

export default Card;
