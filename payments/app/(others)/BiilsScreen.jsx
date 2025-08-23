import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { 
    View, 
    Text, 
    FlatList, 
    StyleSheet, 
    ActivityIndicator, 
    TouchableOpacity,
    RefreshControl,
    Alert
} from "react-native";
import { useRouter } from "expo-router";
import { Picker } from '@react-native-picker/picker';

const API_BASE_URL = 'https://moneymanagementapp-production.up.railway.app';

export default function CompanyBillsList() {
    const { name, code, amount, outbal } = useLocalSearchParams();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const [sortFilter, setSortFilter] = useState('oldest');
    const [statusFilter, setStatusFilter] = useState('pending');
    const [showFilters, setShowFilters] = useState(false);

    const router = useRouter();
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        resetAndFetchBills();
    }, [sortFilter, statusFilter]);

    const resetAndFetchBills = () => {
        setBills([]);
        setCurrentPage(0);
        setHasMore(true);
        fetchBills(0, true);
    };

    const fetchBills = async (page = 0, reset = false) => {
        if (!reset && page === 0) setLoading(true);
        if (page > 0) setLoadingMore(true);

        try {
            const skip = page * ITEMS_PER_PAGE;
            const url = `${API_BASE_URL}/companies/${code}/bills?status=${statusFilter}&sort=${sortFilter}&skip=${skip}&limit=${ITEMS_PER_PAGE}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (reset || page === 0) {
                setBills(data.items || []);
            } else {
                setBills(prevBills => [...prevBills, ...(data.items || [])]);
            }
            
            setHasMore(data.items && data.items.length === ITEMS_PER_PAGE);
            setCurrentPage(page);
            
        } catch (error) {
            console.error('Error fetching bills:', error);
            Alert.alert('Error', 'Failed to fetch bills. Please try again.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        resetAndFetchBills();
    }, [sortFilter, statusFilter]);

    const loadMoreBills = () => {
        if (!loadingMore && hasMore) {
            fetchBills(currentPage + 1);
        }
    };

    const renderFilterSection = () => (
        <View style={styles.filterContainer}>
            <TouchableOpacity 
                style={styles.filterToggle}
                onPress={() => setShowFilters(!showFilters)}
            >
                <Text style={styles.filterIcon}>⚡</Text>
                <Text style={styles.filterText}>Filter</Text>
                <Text style={styles.filterArrow}>{showFilters ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            
            {showFilters && (
                <View style={styles.filterOptions}>
                    <View style={styles.filterRow}>
                        <Text style={styles.filterLabel}>Sort:</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={sortFilter}
                                onValueChange={(value) => setSortFilter(value)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Oldest First" value="oldest" />
                                <Picker.Item label="Recent First" value="recent" />
                                <Picker.Item label="Amount (High to Low)" value="amount_desc" />
                            </Picker>
                        </View>
                    </View>
                    
                    <View style={styles.filterRow}>
                        <Text style={styles.filterLabel}>Status:</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={statusFilter}
                                onValueChange={(value) => setStatusFilter(value)}
                                style={styles.picker}
                            >
                                <Picker.Item label="Pending" value="pending" />
                                <Picker.Item label="Paid" value="paid" />
                            </Picker>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );

    const renderBillItem = ({ item }) => (
        <TouchableOpacity 
            style={styles.billCard} 
            activeOpacity={0.7} 
            onPress={() => router.push({
                pathname: "./PaymentDetail",
                params: {
                    name, 
                    code, 
                    amount, 
                    outbal, 
                    bill_number: item.bill_number, 
                    bill_date: item.bill_date, 
                    due_date: item.due_date, 
                    status: item.status, 
                    amount_paid: item.amount_paid,
                    bill_amount: item.amount
                }
            })}
        >
            <View style={styles.row}>
                <Text style={styles.billNumber}>{item.bill_number}</Text>
                <Text style={[styles.status, billStatusColor(item.status)]}>
                    {item.status.toUpperCase()}
                </Text>
            </View>

            <Text style={styles.label}>
                Bill Date: <Text style={styles.value}>{item.bill_date}</Text>
            </Text>
            <Text style={styles.label}>
                Due Date: <Text style={styles.value}>{item.due_date}</Text>
            </Text>

            <Text style={styles.label}>
                Amount: <Text style={[styles.value, { color: "black" }]}>₹{item.amount}</Text>
            </Text>
            <Text style={styles.label}>
                Paid: <Text style={[styles.value, { color: "#189A7D", fontWeight:'500' }]}>₹{item.amount_paid}</Text>
            </Text>
        </TouchableOpacity>
    );

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator color="#1f75fe" size="small" />
                <Text style={styles.loadingText}>Loading more bills...</Text>
            </View>
        );
    };

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No bills found for the selected filters.</Text>
            <TouchableOpacity 
                style={styles.retryButton}
                onPress={resetAndFetchBills}
            >
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.companyBox}>
                <Text style={styles.compName}>{name}</Text>
                <View style={styles.row}>
                    <Text style={styles.code}>Code: {code}</Text>
                </View>

                <Text style={styles.label}>
                    Amount: <Text style={[styles.amount, styles.value]}>₹{amount}</Text>
                </Text>
                <Text style={styles.label}>
                    Outstanding: <Text style={[styles.outbal, styles.value]}>₹{outbal}</Text>
                </Text>
            </View>

            {renderFilterSection()}

            <View style={styles.billsHeader}>
                <Text style={styles.title}>Bills</Text>
                <Text style={styles.billCount}>
                    {bills.length} bill{bills.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {loading ? (
                <ActivityIndicator color="#1f75fe" size="large" style={{ marginTop: 22 }} />
            ) : (
                <FlatList
                    data={bills}
                    keyExtractor={item => item.id ? item.id.toString() : item.bill_number}
                    renderItem={renderBillItem}
                    ListEmptyComponent={renderEmptyComponent}
                    ListFooterComponent={renderFooter}
                    onEndReached={loadMoreBills}
                    onEndReachedThreshold={0.1}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

// Helper to color bill status
function billStatusColor(status) {
    switch (status) {
        case "pending":
            return { backgroundColor: "#ffe3e3", color: "#d73838" };
        case "paid":
            return { backgroundColor: "#e9f8ed", color: "#209653" };
        case "partial":
            return { backgroundColor: "#fff5e6", color: "#e37a1d" };
        default:
            return { backgroundColor: "#f0f0f0", color: "#666" };
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#f8fafd"
    },
    companyBox: {
        backgroundColor: "#fff",
        padding: 18,
        borderRadius: 18,
        marginBottom: 18,
        shadowColor: "#bae4ec",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 2,
    },
    compName: {
        fontSize: 22,
        fontWeight: "800",
        color: "#000",
        marginBottom: 5
    },
    code: {
        fontSize: 15,
        color: "#000",
        fontWeight: "600"
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        marginBottom: 6
    },
    label: {
        fontSize: 14,
        color: "black",
        fontWeight: "400"
    },
    amount: {
        color: "#000",
        fontWeight: "500"
    },
    outbal: {
        color: "#db5151",
        fontWeight: "700"
    },
    value: {
        fontSize: 15,
        fontWeight: "400"
    },
    filterContainer: {
        backgroundColor: "#fff",
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: "#bae4ec",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
    },
    filterToggle: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
    },
    filterIcon: {
        fontSize: 18,
        marginRight: 8,
    },
    filterText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
        flex: 1,
    },
    filterArrow: {
        fontSize: 14,
        color: "#666",
    },
    filterOptions: {
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
        padding: 16,
        paddingTop: 12,
    },
    filterRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: "500",
        color: "#333",
        width: 60,
    },
    pickerContainer: {
        flex: 1,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#e0e0e0",
        backgroundColor: "#f9f9f9",
    },
    picker: {
        height: 60,
    },
    billsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: "rgba(0, 0, 0, 0.8)",
    },
    billCount: {
        fontSize: 14,
        color: "#666",
        fontWeight: "500",
    },
    billCard: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 14,
        shadowColor: "#bae4ec",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 2
    },
    billNumber: {
        fontSize: 15,
        color: "#000",
        fontWeight: "700",
    },
    status: {
        fontSize: 11,
        fontWeight: "600",
        borderRadius: 8,
        overflow: "hidden",
        paddingHorizontal: 10,
        paddingVertical: 4,
        textTransform: "capitalize",
        marginLeft: "auto",
    },
    footerLoader: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 20,
    },
    loadingText: {
        marginLeft: 10,
        fontSize: 14,
        color: "#666",
    },
    emptyContainer: {
        alignItems: "center",
        paddingVertical: 40,
    },
    empty: {
        textAlign: "center",
        color: "#8e99b6",
        fontSize: 15,
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: "#1f75fe",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
});