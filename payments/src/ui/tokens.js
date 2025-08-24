// Central design tokens for unified dark theme
export const tokens = {
    colors: {
        // Grey 800 inspired palette for improved comfort & readability
        bg: '#1f2933',        // primary background
        bgAlt: '#323f4b',     // alternate section background
        card: '#27323d',      // card surface
        cardAlt: '#364350',   // elevated card surface
        border: 'rgba(255,255,255,0.07)',
        divider: 'rgba(255,255,255,0.18)',
        text: '#ffffff',
        textDim: 'rgba(255,255,255,0.72)',
        textSubtle: 'rgba(255,255,255,0.55)',
        textFaint: 'rgba(255,255,255,0.42)',
        accent: '#9fdf56',      // softened accent for dark bg
        accentAlt: '#89c84a',
        danger: '#ef5350',
        warning: '#ffca28',
        success: '#66bb6a',
        info: '#42a5f5',
    },
    space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
    radius: { sm: 6, md: 12, lg: 20, pill: 999 },
    fontSize: { xs: 14, sm: 16, md: 18, lg: 22, xl: 28 },
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
