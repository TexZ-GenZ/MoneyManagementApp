import React, { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StorageService } from "../../src/services/storageService"
import { useRouter } from "expo-router";

const API_BASE_URL = 'https://moneymanagementapp-production.up.railway.app';

export default function PaymentDetails() {
    const { name, code, amount, outbal, bill_number, bill_id } = useLocalSearchParams();
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedIdx, setExpandedIdx] = useState(null);

    const router = useRouter();
    const token = StorageService.getToken();
    const userRole = "executive"; // You can get this from storage or context as well

    useEffect(() => {
        fetchPaymentHistory();
    }, [bill_id]);

    const fetchPaymentHistory = async () => {
        if (!bill_id) {
            Alert.alert('Error', 'Bill ID is required to fetch payment history.');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const response = await fetch(`${API_BASE_URL}/bills/${bill_id}/payments`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`, // Include token if required
                },
            });

            if (!response.ok) {
                if (response.status === 401) {
                    Alert.alert('Error', 'Unauthorized access. Please login again.');
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Handle both array response and object with items array
            const payments = Array.isArray(data) ? data : (data.items || data.payments || []);
            setPaymentHistory(payments);

        } catch (error) {
            console.error('Error fetching payment history:', error);
            Alert.alert(
                'Error',
                'Failed to fetch payment history. Please check your connection and try again.',
                [
                    { text: 'Retry', onPress: fetchPaymentHistory },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPaymentHistory();
    };

    const renderDropdown = (item, idx) => (
        <TouchableOpacity
            onPress={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            activeOpacity={0.7}
            style={styles.dropdownToggle}
        >
            <View style={styles.dropdownHeader}>
                <Text style={styles.dropTitle}>Comments</Text>
                <Text style={styles.dropdownIcon}>{expandedIdx === idx ? '▲' : '▼'}</Text>
            </View>
            {expandedIdx === idx && (
                <View style={styles.dropContent}>
                    <View style={styles.commentRow}>
                        <Text style={styles.commentLabel}>Accountant:</Text>
                        <Text style={styles.commentValue}>
                            {item.accountant_comment || "No comment"}
                        </Text>
                    </View>

                    <View style={styles.commentRow}>
                        <Text style={styles.commentLabel}>Admin:</Text>
                        <Text style={styles.commentValue}>
                            {item.admin_comment || "No comment"}
                        </Text>
                    </View>

                    <View style={styles.commentRow}>
                        <Text style={styles.commentLabel}>Location Verified:</Text>
                        <Text style={[styles.commentValue, {
                            color: item.exec_location_verified ? "#209653" : "#d73838"
                        }]}>
                            {item.exec_location_verified === undefined
                                ? "N/A"
                                : item.exec_location_verified ? "Yes" : "No"
                            }
                        </Text>
                    </View>
                </View>
            )}
        </TouchableOpacity>
    );

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';

        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch (error) {
            return dateString; // Return original if parsing fails
        }
    };

    const renderPaymentItem = ({ item, index }) => (
        <View style={styles.billCard}>
            <View style={styles.row}>
                <Text style={styles.billNumber}>₹{item.amount || '0.00'}</Text>
                <Text style={[styles.status, statusColor(item.payment_status)]}>
                    {(item.payment_status || 'unknown').toUpperCase()}
                </Text>
            </View>

            <Text style={styles.label}>
                Date: <Text style={styles.value}>{formatDate(item.collected_at)}</Text>
            </Text>
            <Text style={styles.label}>
                Method: <Text style={styles.value}>{item.method || 'N/A'}</Text>
            </Text>

            {item.transaction_id && (
                <Text style={styles.label}>
                    Transaction ID: <Text style={styles.value}>{item.transaction_id}</Text>
                </Text>
            )}

            {renderDropdown(item, index)}
        </View>
    );

    const renderEmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No payments found for this bill.</Text>
            <TouchableOpacity
                style={styles.retryButton}
                onPress={fetchPaymentHistory}
            >
                <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    const getTotalPaid = () => {
        return paymentHistory
            .filter(payment => payment.payment_status === 'success')
            .reduce((total, payment) => total + parseFloat(payment.amount || 0), 0)
            .toFixed(2);
    };

    return (
        <View style={styles.container}>
            <View style={styles.companyBox}>
                <Text style={styles.compName}>{name}</Text>
                <View style={styles.row}>
                    <Text style={styles.code}>Code: {code}</Text>
                    <Text style={[styles.code, { marginLeft: 16 }]}>Bill: {bill_number}</Text>
                </View>

                <Text style={styles.label}>
                    Bill Amount: <Text style={[styles.amount, styles.value]}>₹{amount}</Text>
                </Text>
                <Text style={styles.label}>
                    Outstanding: <Text style={[styles.outbal, styles.value]}>₹{outbal}</Text>
                </Text>

                {paymentHistory.length > 0 && (
                    <Text style={styles.label}>
                        Total Paid: <Text style={[styles.totalPaid, styles.value]}>₹{getTotalPaid()}</Text>
                    </Text>
                )}
            </View>

            <View style={styles.paymentsHeader}>
                <Text style={styles.title}>Payment History</Text>
                <Text style={styles.paymentCount}>
                    {paymentHistory.length} payment{paymentHistory.length !== 1 ? 's' : ''}
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#1f75fe" size="large" />
                    <Text style={styles.loadingText}>Loading payment history...</Text>
                </View>
            ) : (
                <FlatList
                    data={paymentHistory}
                    keyExtractor={(item, idx) => item.id ? item.id.toString() : idx.toString()}
                    renderItem={renderPaymentItem}
                    ListEmptyComponent={renderEmptyComponent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {userRole === "executive" && (
                <TouchableOpacity
                    style={styles.button}
                    activeOpacity={0.7}
                    onPress={() => router.push({
                        pathname: "./PaymentScreen",
                        params: {
                            company_code: code,
                            bill_id: bill_id,
                            bill_number: bill_number,
                            bill_amount: amount
                        }
                    })
                    }
                >
                    <Text style={styles.buttonText}>Add Payment</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

// Helper for status coloring
function statusColor(status) {
    switch (status.toLowerCase()) {
        case "pending":
            return { backgroundColor: "#ffe3e3", color: "#d73838" };
        case "success":
        case "paid":
        case "completed":
            return { backgroundColor: "#e9f8ed", color: "#209653" };
        case "failed":
        case "rejected":
            return { backgroundColor: "#ffe3e3", color: "#d73838" };
        case "processing":
            return { backgroundColor: "#fff5e6", color: "#e37a1d" };
        default:
            return { backgroundColor: "#f0f0f0", color: "#666" };
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#f8fafd",
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
        fontSize: 18,
        fontWeight: "800",
        color: "#000",
        marginBottom: 5
    },
    code: {
        fontSize: 15,
        color: "#000",
        fontWeight: "400"
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
        fontWeight: "400"
    },
    outbal: {
        color: "#db5151",
        fontWeight: "700"
    },
    totalPaid: {
        color: "#209653",
        fontWeight: "700"
    },
    value: {
        fontSize: 14,
        fontWeight: "400"
    },
    paymentsHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    title: {
        fontSize: 14,
        fontWeight: "700",
        color: "#000",
    },
    paymentCount: {
        fontSize: 14,
        color: "rgba(0, 0, 0, 0.6)",
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
        fontSize: 16,
        color: "#123651",
        fontWeight: "700",
    },
    status: {
        fontSize: 13,
        fontWeight: "700",
        borderRadius: 8,
        overflow: "hidden",
        paddingHorizontal: 10,
        paddingVertical: 4,
        textTransform: "capitalize",
        marginLeft: "auto",
    },
    dropdownToggle: {
        marginTop: 12,
        backgroundColor: "#f2f6fa",
        borderRadius: 10,
    },
    dropdownHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
    },
    dropTitle: {
        fontWeight: "700",
        color: "#215087",
        fontSize: 14,
    },
    dropdownIcon: {
        color: "#215087",
        fontSize: 12,
        fontWeight: "bold",
    },
    dropContent: {
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: "#e8ecf0",
    },
    commentRow: {
        marginBottom: 8,
    },
    commentLabel: {
        color: "#354c68",
        fontWeight: "700",
        fontSize: 13,
        marginBottom: 2,
    },
    commentValue: {
        color: "#4f6480",
        fontSize: 13,
        fontWeight: "500",
        lineHeight: 18,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 16,
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
    button: {
        backgroundColor: "#007BFF",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        position: "absolute",
        bottom: 45,
        left: 16,
        right: 16,
        shadowColor: "#007BFF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});