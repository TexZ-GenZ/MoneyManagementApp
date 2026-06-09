import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { SkeletonCard } from '../../src/ui/components/SkeletonBlock';
import { tokens } from '../../src/ui/tokens';
import ApprovalItemCard from '../../src/ui/components/ApprovalItemCard';
import { onPaymentUpdate } from '../../src/events/paymentEvents';
import { API_BASE_URL } from '../../src/utils/constants';

export default function AdminNotifyScreen() {
    const BASE = API_BASE_URL;
    const [search, setSearch] = useState('');
    const [approvalItems, setApprovalItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedExecs, setSelectedExecs] = useState(new Set()); // Use Set for better performance
    const [execMap, setExecMap] = useState({});
    const [showFilters, setShowFilters] = useState(false);

    // Build exec options from API data and approvalItems
    const execOptions = (() => {
        const ids = new Set();

        // Add executives from approval items
        approvalItems.forEach(item => {
            if (item.executive_id) {
                ids.add(item.executive_id);
            }
        });

        // Add executives from exec map
        Object.keys(execMap).forEach(k => {
            ids.add(Number(k));
        });

        return Array.from(ids)
            .map(id => ({
                id,
                name: execMap[id] || `Executive ${id}`,
                count: approvalItems.filter(item => item.executive_id === id).length
            }))
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    })();

    // Improved filtering logic
    const filteredItems = approvalItems.filter(item => {
        // Search filter - check multiple fields
        const searchLower = search.toLowerCase().trim();
        const matchesSearch = !searchLower ||
            item.company_code.toLowerCase().includes(searchLower) ||
            (item.company_name || '').toLowerCase().includes(searchLower) ||
            (item.company_area || '').toLowerCase().includes(searchLower) ||
            (execMap[item.executive_id] || `Executive ${item.executive_id}`).toLowerCase().includes(searchLower);

        // Executive filter
        const matchesExec = selectedExecs.size === 0 || selectedExecs.has(item.executive_id);

        return matchesSearch && matchesExec;
    });

    const fetchApprovalData = async () => {
        try {
            const token = await StorageService.getToken();
            const response = await fetch(`${BASE}/admin/payments/pending`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.access_token}`
                },
            });

            if (!response.ok) throw new Error('HTTP error');

            const data = await response.json();
            const items = data.items || [];

            // Enrich with company details
            const enriched = await Promise.all(items.map(async item => {
                try {
                    const companyResponse = await fetch(
                        `${BASE}/companies/${item.company_code}`,
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token.access_token}`
                            }
                        }
                    );

                    if (companyResponse.ok) {
                        const company = await companyResponse.json();
                        return {
                            ...item,
                            company_name: company.name,
                            company_area: company.area
                        };
                    }
                } catch (error) {
                    console.warn('Failed to fetch company details for', item.company_code);
                }
                return item;
            }));

            setApprovalItems(enriched);
        } catch (error) {
            console.error('Fetch approval data error:', error);
            Alert.alert('Error', 'Failed to load approval items. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchExecutives = async () => {
        try {
            const token = await StorageService.getToken();
            const response = await fetch(`${BASE}/admin/users`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.access_token}`
                }
            });

            if (!response.ok) return;

            const data = await response.json();
            const userList = data.items || data || [];
            const executiveMap = {};

            userList.forEach(user => {
                if (user && user.role === 'executive') {
                    executiveMap[user.id] = user.username || user.name || `Executive ${user.id}`;
                }
            });

            setExecMap(executiveMap);
        } catch (error) {
            console.warn('Failed to fetch executives:', error);
        }
    };

    useEffect(() => {
        fetchApprovalData();
        fetchExecutives();
    }, []);

    useEffect(() => {
        const unsubscribe = onPaymentUpdate(event => {
            if (event?.id) {
                setApprovalItems(items => items.filter(item => item.id !== event.id));
            }
        });
        return unsubscribe;
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchApprovalData();
    };

    const toggleExecutiveFilter = (execId) => {
        setSelectedExecs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(execId)) {
                newSet.delete(execId);
            } else {
                newSet.add(execId);
            }
            return newSet;
        });
    };

    const clearAllFilters = () => {
        setSelectedExecs(new Set());
        setSearch('');
    };

    const clearSearch = () => {
        setSearch('');
    };

    const hasActiveFilters = search.trim() !== '' || selectedExecs.size > 0;

    const [scrollY, setScrollY] = useState(0);

    const handleScroll = (event) => {
        const currentScrollY = event.nativeEvent.contentOffset.y;

        // Only close filters if user has scrolled down significantly (more than 50px)
        if (showFilters && currentScrollY > scrollY + 50) {
            setShowFilters(false);
        }

        setScrollY(currentScrollY);
    };

    const renderItem = ({ item }) => (<ApprovalItemCard item={item} />);

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={48} color={tokens.colors.textDim} />
            <Text style={styles.emptyTitle}>
                {hasActiveFilters ? 'No matches found' : 'No pending approvals'}
            </Text>
            <Text style={styles.emptySubtitle}>
                {hasActiveFilters ? 'Try adjusting your filters' : 'All caught up!'}
            </Text>
            {hasActiveFilters && (
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
                    <Text style={styles.clearFiltersText}>Clear all filters</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    // Header moved inline into ListHeaderComponent to avoid remounts and keep TextInput focus stable

    return (
        <Screen title="Admin Approvals" subtitle={`${filteredItems.length} of ${approvalItems.length} items`}>
            <FlatList
                data={loading ? [] : filteredItems}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListHeaderComponent={(
                    <Card style={styles.searchCard}>
                        <View style={styles.searchContainer}>
                            <View style={styles.searchInputContainer}>
                                <Ionicons name="search" color={tokens.colors.textDim} size={18} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search by company name"
                                    placeholderTextColor={tokens.colors.textDim}
                                    value={search}
                                    onChangeText={setSearch}
                                    returnKeyType="search"
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    blurOnSubmit={false}
                                />
                                {search !== '' && (
                                    <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                                        <Ionicons name="close-circle" size={18} color={tokens.colors.textDim} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={handleRefresh}
                                disabled={refreshing}
                                style={styles.refreshButton}
                            >
                                <Ionicons
                                    name="refresh"
                                    size={20}
                                    color={tokens.colors.accent}
                                    style={refreshing ? styles.refreshing : {}}
                                />
                            </TouchableOpacity>
                        </View>
                        {execOptions.length > 0 && (
                            <TouchableOpacity
                                style={styles.filterToggle}
                                onPress={() => setShowFilters(!showFilters)}
                            >
                                <View style={styles.filterToggleLeft}>
                                    <Ionicons name="funnel-outline" size={16} color={tokens.colors.textDim} />
                                    <Text style={styles.filterToggleText}>
                                        Executive Filter
                                        {selectedExecs.size > 0 && ` (${selectedExecs.size})`}
                                    </Text>
                                </View>
                                <Ionicons
                                    name={showFilters ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={tokens.colors.textDim}
                                />
                            </TouchableOpacity>
                        )}
                        {showFilters && execOptions.length > 0 && (
                            <View style={styles.filterContainer}>
                                <View style={styles.chipContainer}>
                                    {execOptions.map(executive => {
                                        const isSelected = selectedExecs.has(executive.id);
                                        return (
                                            <TouchableOpacity
                                                key={executive.id}
                                                style={[
                                                    styles.chip,
                                                    isSelected ? styles.chipSelected : styles.chipUnselected
                                                ]}
                                                onPress={() => toggleExecutiveFilter(executive.id)}
                                            >
                                                <Text
                                                    style={[
                                                        styles.chipText,
                                                        isSelected && styles.chipTextSelected
                                                    ]}
                                                >
                                                    {executive.name}
                                                </Text>
                                                {executive.count > 0 && (
                                                    <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                                                        <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                                                            {executive.count}
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                {selectedExecs.size > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setSelectedExecs(new Set())}
                                        style={styles.clearChipsButton}
                                    >
                                        <Text style={styles.clearChipsText}>Clear selection</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {loading && (
                            <View style={styles.skeletonContainer}>
                                <SkeletonCard />
                                <SkeletonCard />
                                <SkeletonCard />
                            </View>
                        )}
                    </Card>
                )}
                ListEmptyComponent={!loading ? renderEmptyState : null}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={tokens.colors.accent}
                    />
                }
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                keyboardShouldPersistTaps="handled"
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    searchCard: {
        marginBottom: 16,
        padding: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.colors.cardAlt,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: tokens.colors.text,
        fontSize: 16,
    },
    clearButton: {
        padding: 2,
    },
    refreshButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: tokens.colors.cardAlt,
    },
    refreshing: {
        opacity: 0.5,
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingVertical: 8,
    },
    filterToggleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    filterToggleText: {
        color: tokens.colors.textDim,
        fontSize: 14,
        fontWeight: '500',
    },
    filterContainer: {
        marginTop: 12,
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
        marginBottom: 8,
        minWidth: 60,
        overflow: 'visible',
    },
    chipSelected: {
        backgroundColor: tokens.colors.accent,
        borderColor: tokens.colors.accent,
    },
    chipUnselected: {
        backgroundColor: 'transparent',
        borderColor: tokens.colors.border,
    },
    chipText: {
        fontSize: 14,
        color: tokens.colors.text,
        marginRight: 6,
        fontWeight: '500',
    },
    chipTextSelected: {
        color: '#000',
        fontWeight: '600',
    },
    badge: {
        backgroundColor: tokens.colors.border,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        minWidth: 20,
        alignItems: 'center',
    },
    badgeSelected: {
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    badgeText: {
        fontSize: 12,
        color: tokens.colors.textDim,
        fontWeight: '600',
    },
    badgeTextSelected: {
        color: '#000',
    },
    clearChipsButton: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    clearChipsText: {
        color: tokens.colors.accent,
        fontSize: 14,
        fontWeight: '500',
    },
    skeletonContainer: {
        gap: 12,
    },
    listContainer: {
        paddingBottom: 80,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: tokens.colors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: tokens.colors.textDim,
        textAlign: 'center',
        lineHeight: 20,
    },
    clearFiltersButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: tokens.colors.accent,
        borderRadius: 8,
    },
    clearFiltersText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '600',
    },
});