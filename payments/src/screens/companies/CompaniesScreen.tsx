import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchCompanies } from '../../store/companiesSlice';
import { Company } from '../../types/company';
import { COLORS } from '../../utils/constants';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const { width } = Dimensions.get('window');

interface CompanyCardProps {
    company: Company;
    onPress: (company: Company) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({ company, onPress }) => {
    const formatCurrency = (amount: string) => {
        const num = parseFloat(amount || '0');
        return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    };

    const getStatusColor = () => {
        const overdue = parseFloat(company.total_overdue || '0');
        const pending = parseFloat(company.total_pending || '0');

        if (overdue > 0) return COLORS.ERROR;
        if (pending > 0) return COLORS.WARNING;
        return COLORS.SUCCESS;
    };

    const getStatusText = () => {
        const overdue = parseFloat(company.total_overdue || '0');
        const pending = parseFloat(company.total_pending || '0');

        if (overdue > 0) return 'OVERDUE';
        if (pending > 0) return 'PENDING';
        return 'UP TO DATE';
    };

    return (
        <TouchableOpacity
            style={styles.companyCard}
            onPress={() => onPress(company)}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>{company.account_n}</Text>
                    <Text style={styles.companyCode}>Code: {company.code}</Text>
                    <Text style={styles.companyArea}>Area: {company.area}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
                    <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.amountRow}>
                    <View style={styles.amountItem}>
                        <Text style={styles.amountLabel}>Overdue</Text>
                        <Text style={[styles.amountValue, { color: COLORS.ERROR }]}>
                            {formatCurrency(company.total_overdue)}
                        </Text>
                    </View>
                    <View style={styles.amountItem}>
                        <Text style={styles.amountLabel}>Pending</Text>
                        <Text style={[styles.amountValue, { color: COLORS.WARNING }]}>
                            {formatCurrency(company.total_pending)}
                        </Text>
                    </View>
                    <View style={styles.amountItem}>
                        <Text style={styles.amountLabel}>Bills</Text>
                        <Text style={styles.amountValue}>{company.bills_count}</Text>
                    </View>
                </View>

                {company.phone && (
                    <View style={styles.contactRow}>
                        <Ionicons name="call" size={16} color={COLORS.GRAY} />
                        <Text style={styles.contactText}>{company.phone}</Text>
                    </View>
                )}

                {company.address && (
                    <View style={styles.contactRow}>
                        <Ionicons name="location" size={16} color={COLORS.GRAY} />
                        <Text style={styles.contactText} numberOfLines={1}>
                            {company.address}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const CompaniesScreen: React.FC = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { companies, isLoading, error } = useAppSelector((state) => state.companies);
    const { user } = useAppSelector((state) => state.auth);

    const [searchQuery, setSearchQuery] = useState('');
    const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadCompanies();
    }, []);

    // Refresh data when screen comes into focus (after payment approval)
    useFocusEffect(
        React.useCallback(() => {
            console.log('🔄 CompaniesScreen focused, refreshing data...');
            loadCompanies();
        }, [])
    );

    useEffect(() => {
        filterCompanies();
    }, [companies, searchQuery]);

    const loadCompanies = async () => {
        try {
            await dispatch(fetchCompanies()).unwrap();
        } catch (error: any) {
            Alert.alert('Error', error || 'Failed to load companies');
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadCompanies();
        setRefreshing(false);
    };

    const filterCompanies = () => {
        if (!searchQuery.trim()) {
            setFilteredCompanies(companies);
            return;
        }

        const filtered = companies.filter((company) =>
            company.account_n.toLowerCase().includes(searchQuery.toLowerCase()) ||
            company.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            company.area.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredCompanies(filtered);
    };

    const handleCompanyPress = (company: Company) => {
        // Navigate to company details screen
        router.push(`/company-details/${company.code}` as any);
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🏢</Text>
            <Text style={styles.emptyStateTitle}>No Companies Found</Text>
            <Text style={styles.emptyStateText}>
                {searchQuery
                    ? 'No companies match your search criteria'
                    : 'No companies assigned to you yet'
                }
            </Text>
            {!searchQuery && (
                <TouchableOpacity style={styles.refreshButton} onPress={loadCompanies}>
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    const renderHeader = () => (
        <View style={styles.header}>
            <Text style={styles.title}>Companies</Text>
            <Text style={styles.subtitle}>
                {user?.role === 'executive'
                    ? 'Your assigned companies'
                    : 'All companies in the system'
                }
            </Text>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={COLORS.GRAY} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search companies..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor={COLORS.GRAY}
                />
                {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={COLORS.GRAY} />
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{filteredCompanies.length}</Text>
                    <Text style={styles.statLabel}>Companies</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                        {filteredCompanies.reduce((sum, company) => sum + company.bills_count, 0)}
                    </Text>
                    <Text style={styles.statLabel}>Total Bills</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: COLORS.ERROR }]}>
                        ₹{filteredCompanies.reduce((sum, company) =>
                            sum + parseFloat(company.total_overdue || '0'), 0
                        ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text style={styles.statLabel}>Total Overdue</Text>
                </View>
            </View>
        </View>
    );

    if (isLoading && companies.length === 0) {
        return (
            <View style={styles.container}>
                <LoadingSpinner message="Loading companies..." />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.errorState}>
                    <Text style={styles.errorIcon}>⚠️</Text>
                    <Text style={styles.errorTitle}>Connection Error</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadCompanies}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={filteredCompanies}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                    <CompanyCard company={item} onPress={handleCompanyPress} />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyState}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.LIGHT,
    },
    header: {
        padding: 16,
        backgroundColor: COLORS.WHITE,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.PRIMARY,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.GRAY,
        marginBottom: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.LIGHT,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: COLORS.text,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.PRIMARY,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.GRAY,
        marginTop: 2,
    },
    companyCard: {
        backgroundColor: COLORS.WHITE,
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    companyInfo: {
        flex: 1,
    },
    companyName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    companyCode: {
        fontSize: 14,
        color: COLORS.GRAY,
        marginBottom: 2,
    },
    companyArea: {
        fontSize: 14,
        color: COLORS.GRAY,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.WHITE,
    },
    cardBody: {
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 12,
    },
    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    amountItem: {
        alignItems: 'center',
        flex: 1,
    },
    amountLabel: {
        fontSize: 12,
        color: COLORS.GRAY,
        marginBottom: 4,
    },
    amountValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    contactText: {
        fontSize: 14,
        color: COLORS.GRAY,
        marginLeft: 8,
        flex: 1,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 64,
    },
    emptyStateIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyStateTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyStateText: {
        fontSize: 16,
        color: COLORS.GRAY,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    refreshButton: {
        backgroundColor: COLORS.PRIMARY,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    refreshButtonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
    errorState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    errorIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.ERROR,
        marginBottom: 8,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 16,
        color: COLORS.GRAY,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    retryButton: {
        backgroundColor: COLORS.ERROR,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: COLORS.WHITE,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CompaniesScreen;
