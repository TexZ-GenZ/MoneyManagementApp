// Central design tokens for unified dark theme
export const tokens = {
    colors: {
        bg: '#000',
        bgAlt: '#070707',
        card: '#0d0d0d',
        cardAlt: '#141414',
        border: 'rgba(255,255,255,0.08)',
        divider: 'rgba(255,255,255,0.15)',
        text: '#FFFFFF',
        textDim: 'rgba(255,255,255,0.6)',
        textSubtle: 'rgba(255,255,255,0.45)',
        textFaint: 'rgba(255,255,255,0.4)',
        accent: '#c8f14c',
        accentAlt: '#b2d739',
        danger: '#ff4d4f',
        warning: '#ffb020',
        success: '#4cc38a',
        info: '#3b82f6',
    },
    space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
    radius: { sm: 6, md: 12, lg: 20, pill: 999 },
    fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 },
    shadow: {
        card: {
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 5,
        },
    },
};

export const typography = {
    heading: {
        fontSize: 22,
        fontWeight: '700',
        color: tokens.colors.text,
    },
    subheading: {
        fontSize: 14,
        color: tokens.colors.textDim,
        fontWeight: '400',
    },
    label: {
        fontSize: 13,
        color: tokens.colors.textDim,
    },
    body: {
        fontSize: 14,
        color: tokens.colors.text,
    },
};

export const utils = {
    cardBase: {
        backgroundColor: tokens.colors.card,
        borderRadius: tokens.radius.lg,
        paddingVertical: tokens.space.lg,
        paddingHorizontal: tokens.space.md,
        borderWidth: 1,
        borderColor: tokens.colors.border,
    },
    focusRing: {
        // Placeholder for future accessibility styling
    },
};
