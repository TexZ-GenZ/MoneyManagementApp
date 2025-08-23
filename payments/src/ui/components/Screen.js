import React from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GridBackground from '../../../app/(others)/GridBGComponent';
import { tokens } from '../tokens';

/**
 * Unified screen wrapper replicating Admin Dashboard dark style.
 * Props:
 *  - children: content
 *  - scroll (bool): wrap children in ScrollView
 *  - header: optional React node (else title/subtitle)
 *  - title / subtitle: strings for standard header
 *  - contentStyle: style override for inner content container
 */
export default function Screen({
    children,
    scroll = false,
    header = null,
    title,
    subtitle,
    contentStyle,
}) {
    const insets = useSafeAreaInsets();
    const Container = scroll ? ScrollView : View;
    return (
        <LinearGradient
            colors={[tokens.colors.bg, tokens.colors.bg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradient}
        >
            <GridBackground />
            <SafeAreaView style={[styles.safe, { paddingBottom: Math.max(16, insets.bottom) }]}>
                <Container
                    style={[styles.content, contentStyle]}
                    contentContainerStyle={scroll ? styles.scrollContent : undefined}
                    showsVerticalScrollIndicator={false}
                >
                    {header || (
                        (title || subtitle) && (
                            <View style={styles.headerBlock}>
                                {title ? <View style={styles.titleWrapper}><HeaderText text={title} /></View> : null}
                                {subtitle ? <View style={styles.subtitleWrapper}><SubtitleText text={subtitle} /></View> : null}
                            </View>
                        )
                    )}
                    {children}
                </Container>
            </SafeAreaView>
        </LinearGradient>
    );
}

const HeaderText = ({ text }) => (
    <View>
        {/* Could use custom Text component */}
        <TextStyled style={styles.title}>{text}</TextStyled>
    </View>
);

const SubtitleText = ({ text }) => (
    <View>
        <TextStyled style={styles.subtitle}>{text}</TextStyled>
    </View>
);

// Lightweight wrapper to avoid importing Text multiple times here.
import { Text } from 'react-native';
const TextStyled = ({ children, style }) => <Text style={style}>{children}</Text>;

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },
    content: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    headerBlock: { marginBottom: 20 },
    title: { fontSize: 22, fontWeight: '700', color: '#f9f9f9' },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
    titleWrapper: {},
    subtitleWrapper: {},
});
