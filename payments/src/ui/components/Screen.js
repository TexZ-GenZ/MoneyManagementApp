import React from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../tokens';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';

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
    hideTopBar = false,
    showTopBarTitle = false,
    topBarTitle = undefined,
    hideBackButton = false,
}) {
    const insets = useSafeAreaInsets();
    const Container = scroll ? ScrollView : View;
    const navigation = useNavigation();
    let canGoBack = false;
    try { canGoBack = navigation?.canGoBack?.() || false; } catch (_) { }
    return (
        <LinearGradient
            colors={[tokens.colors.bg, tokens.colors.bg]} // solid background for higher readability
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.gradient}
        >
            <SafeAreaView style={[styles.safe, { paddingBottom: 0, paddingTop: hideTopBar ? 20 : 10 }]}>
                {!hideTopBar && (
                    <View style={[styles.topBar, { paddingTop: Math.max(4, insets.top) }]}>
                        {canGoBack && !hideBackButton ? (
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Back"
                                onPress={() => navigation.goBack()}
                                style={styles.backBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
                                <Text style={styles.backText}>Back</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.backPlaceholder} />
                        )}
                        <Text style={styles.topBarTitle} numberOfLines={1}>{showTopBarTitle ? (topBarTitle || title || (typeof header === 'string' ? header : '')) : ' '}</Text>
                        <View style={styles.rightActionsPlaceholder} />
                    </View>
                )}
                <Container
                    style={[styles.content, contentStyle]}
                    contentContainerStyle={scroll ? styles.scrollContent : undefined}
                    showsVerticalScrollIndicator={false}
                >
                    {header != null ? (
                        typeof header === 'string' || typeof header === 'number'
                            ? <TextStyled style={styles.inlineHeaderText}>{header}</TextStyled>
                            : header
                    ) : null}
                    {!header && (title || subtitle) ? (
                        <View style={styles.headerBlock}>
                            {title ? <View style={styles.titleWrapper}><HeaderText text={title} /></View> : null}
                            {subtitle ? <View style={styles.subtitleWrapper}><SubtitleText text={subtitle} /></View> : null}
                        </View>
                    ) : null}
                    {React.Children.map(children, (child, idx) => {
                        if (typeof child === 'string' || typeof child === 'number') {
                            if (__DEV__) {
                                // eslint-disable-next-line no-console
                                console.warn('[Screen] Wrapped primitive child', { idx, value: child });
                            }
                            return <TextStyled key={idx} style={styles.inlineChildText}>{child}</TextStyled>;
                        }
                        return child;
                    })}
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

const TextStyled = ({ children, style }) => <Text style={style}>{children}</Text>;

const styles = StyleSheet.create({
    gradient: { flex: 1, backgroundColor: '#0d1117' },
    safe: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    backBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: tokens.colors.cardAlt, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.colors.border },
    backText: { color: tokens.colors.text, fontSize: 15, fontWeight: '600', marginLeft: 4 },
    backPlaceholder: { width: 72, height: 32 },
    rightActionsPlaceholder: { width: 72, height: 32 },
    topBarTitle: { flex: 1, textAlign: 'center', color: tokens.colors.text, fontSize: 20, fontWeight: '800', paddingHorizontal: 8, letterSpacing: 0.5 },
    content: { flex: 1 },
    scrollContent: { paddingBottom: 8 },
    headerBlock: { marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: 0.6 },
    subtitle: { fontSize: 18, color: 'rgba(255,255,255,0.75)', marginTop: 8 },
    titleWrapper: {},
    subtitleWrapper: {},
    inlineHeaderText: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginBottom: 20 },
    inlineChildText: { color: '#ffffff', fontSize: 18, lineHeight: 26 },
});
