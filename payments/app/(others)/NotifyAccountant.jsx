import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { SkeletonCard } from '../../src/ui/components/SkeletonBlock';
import { tokens } from '../../src/ui/tokens';
import ApprovalItemCard from '../../src/ui/components/ApprovalItemCard';
import { onPaymentUpdate } from '../../src/events/paymentEvents';

export default function AccountantNotifyScreen() {
    const BASE = process.env.APP_URI || process.env.EXPO_PUBLIC_APP_URI;
    const [search, setSearch] = useState('');
    const [approvalItems, setApprovalItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedExecs, setSelectedExecs] = useState(new Set());
    const [execMap, setExecMap] = useState({});
    const [showFilters, setShowFilters] = useState(false);

    // Build exec options from API data and approvalItems
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const execOptions = useMemo(() => {
        const ids = new Set();

        // Add executives from approval items
        approvalItems.forEach(item => {
            const num = toNum(item.executive_id);
            if (num !== null) {
                ids.add(num);
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
                count: approvalItems.filter(item => toNum(item.executive_id) === id).length
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [approvalItems, execMap]);

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
        const execId = toNum(item.executive_id);
        const matchesExec = selectedExecs.size === 0 || (execId !== null && selectedExecs.has(execId));

        return matchesSearch && matchesExec;
    });

    const handleScroll = () => {
        if (showFilters) setShowFilters(false);
    };

    const toggleFilters = () => setShowFilters(v => !v);

    const fetchApprovalData = async () => {
        try {
            const token = await StorageService.getToken();
            const baseHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.access_token}`
            };

            const response = await fetch(`${BASE}/accountant/payments/pending`, {
                method: 'GET',
                headers: baseHeaders
            });

            if (!response.ok) throw new Error('HTTP error');

            const data = await response.json();
            const items = data.items || [];

            // Enrich with company details
            const enriched = await Promise.all(items.map(async item => {
                try {
                    const companyResponse = await fetch(
                        `${BASE}/companies/${item.company_code}`,
                        { headers: baseHeaders }
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
            const baseHeaders = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.access_token}`
            };

            // Preferred: accountant-accessible executives list
            const response = await fetch(`${BASE}/admin/executives`, { headers: baseHeaders });
            if (response.ok) {
                const data = await response.json();
                const list = Array.isArray(data) ? data : (data?.items || []);
                const executiveMap = {};
                list.forEach(user => {
                    if (user && (user.role?.toLowerCase?.() === 'executive' || !user.role)) {
                        executiveMap[user.id] = user.username || user.name || `Executive ${user.id}`;
                    }
                });
                if (Object.keys(executiveMap).length) {
                    setExecMap(executiveMap);
                    return; // done
                }
            }

            // Fallback: derive executive list from recent payment activity (accountant can access)
            const act = await fetch(`${BASE}/payments/activity?limit=500`, { headers: baseHeaders });
            if (act.ok) {
                const payload = await act.json();
                const items = Array.isArray(payload.items) ? payload.items : [];
                const map = {};
                items.forEach(it => {
                    const id = it.executive_id || it.executiveId;
                    if (!id) return;
                    const name = it.executive_name || it.executive_username || it.executive || `Executive ${id}`;
                    if (id in map) return;
                    map[id] = name;
                });
                // Also include any execs from current approval items
                approvalItems.forEach(it => {
                    if (it.executive_id && !(it.executive_id in map)) {
                        map[it.executive_id] = `Executive ${it.executive_id}`;
                    }
                });
                if (Object.keys(map).length) setExecMap(map);
            }
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
            if (!event || !event.id) return;
            setApprovalItems(items => items.filter(item => item.id !== event.id));
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

    const ListHeader = () => (
        <Card style={styles.searchCard}>
            {/* Search Row */}
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

            {/* Filter Toggle */}
            {execOptions.length > 0 && (
                <TouchableOpacity
                    style={styles.filterToggle}
                    onPress={toggleFilters}
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

            {/* Executive Filter Chips */}
            {showFilters && execOptions.length > 0 && (
                <View style={[styles.filterContainer]}>
                    <View style={styles.chipContainer}>
                        {execOptions.map(executive => {
                            const isSelected = selectedExecs.has(executive.id);
                            return (
                                <TouchableOpacity
                                    key={executive.id}
                                    style={[styles.chip, isSelected ? styles.chipSelected : styles.chipUnselected]}
                                    onPress={() => toggleExecutiveFilter(executive.id)}
                                >
                                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
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
                        <TouchableOpacity onPress={() => setSelectedExecs(new Set())} style={styles.clearChipsButton}>
                            <Text style={styles.clearChipsText}>Clear selection</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </Card>
    );

    return (
        <Screen title="Accountant Approvals" subtitle={`${filteredItems.length} of ${approvalItems.length} items`}>
            <FlatList
                data={loading ? [] : filteredItems}
                keyExtractor={item => (item?.id ?? Math.random()).toString()}
                renderItem={renderItem}
                ListHeaderComponent={ListHeader}
                ListEmptyComponent={loading ? (
                    <View style={styles.skeletonContainer}>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </View>
                ) : renderEmptyState}
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
        paddingHorizontal: 12,
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