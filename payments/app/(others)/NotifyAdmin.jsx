import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StorageService } from "../../src/services/storageService";

// Mock executiveId to name mapping - you might want to fetch this from API too
const executiveNames = {
    0: "Test Exec",
    1: "Alice",
    2: "Bob",
    3: "Charlie",
    4: "David",
    5: "Emma"
};

export default function AdminNotifyScreen() {
    const [search, setSearch] = useState("");
    const [approvalItems, setApprovalItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalAction, setModalAction] = useState(null); // "approve" or "reject"
    const [modalItem, setModalItem] = useState(null);
    const [modalComment, setModalComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [actionSubmittingId, setActionSubmittingId] = useState(null); // id of item being processed

    const filteredItems = approvalItems.filter(item =>
        item.company_code.toLowerCase().includes(search.toLowerCase()) ||
        (executiveNames[item.executive_id] || "").toLowerCase().includes(search.toLowerCase())
    );

    const fetchApprovalData = async () => {
        try {
            const token = await StorageService.getToken();
            
            const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/payments/pending`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            //console.log("Fetched approval data:", data);
            
            // Set the items array from the response
            setApprovalItems(data.items || []);
        } catch (error) {
            console.error("Error fetching approval data:", error);
            Alert.alert(
                "Fetch Error", 
                "Failed to load approval items. Please check your connection and try again.",
                [{ text: "OK" }]
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchApprovalData();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchApprovalData();
    };

    const handleApprove = (item) => {
        // Previously opened a modal for approve. Keeping the modal logic here commented
        // so it can be restored quickly if needed.
        // setModalAction("approve");
        // setModalItem(item);
        // setModalComment("");
        // setModalVisible(true);

        // Now directly call the approve endpoint and show a per-item loading state.
        (async () => {
            setActionSubmittingId(item.id);
            try {
                const tokenObj = await StorageService.getToken();
                const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}/admin/payments/${item.id}/approve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokenObj?.access_token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                console.log('Payment approved:', result);

                Alert.alert(
                    'Success',
                    'Payment approved successfully!',
                    [{ text: 'OK' }]
                );

                // Remove the item from the list
                setApprovalItems(prev => prev.filter(i => i.id !== item.id));
            } catch (error) {
                console.error('Error approving payment:', error);
                Alert.alert('Approve Failed', 'Failed to approve payment. Please try again.');
            } finally {
                setActionSubmittingId(null);
            }
        })();
    };

    const handleReject = (item) => {
        setModalAction("reject");
        setModalItem(item);
        setModalComment("");
        setModalVisible(true);
    };

    const handleModalSubmit = async () => {
        if (!modalItem) return;

        setSubmitting(true);
        try {
            const tokenObj = await StorageService.getToken();

            // For admin endpoints we use the /admin prefix. On reject we send a
            // decline request with the comment as a query param. On approve we call the
            // approve endpoint.
            let url = '';
            if (modalAction === 'approve') {
                url = `${process.env.EXPO_PUBLIC_APP_URI}/admin/payments/${modalItem.id}/approve`;
            } else {
                const comment = encodeURIComponent(modalComment.trim() || '');
                url = `${process.env.EXPO_PUBLIC_APP_URI}/admin/payments/${modalItem.id}/decline?comment=${comment}`;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${tokenObj?.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(`Payment ${modalAction}d:`, result);

            setModalVisible(false);

            Alert.alert(
                'Success',
                modalAction === 'approve' ? 'Payment approved successfully!' : 'Payment rejected successfully!',
                [{ text: 'OK' }]
            );

            // Remove the item from the list or refresh the data
            setApprovalItems(prev => prev.filter(item => item.id !== modalItem.id));
            
        } catch (error) {
            console.error(`Error ${modalAction}ing payment:`, error);
            Alert.alert(
                "Action Failed", 
                `Failed to ${modalAction} payment. Please try again.`,
                [{ text: "OK" }]
            );
        } finally {
            setSubmitting(false);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.company}>{item.company_code}</Text>
                <Text style={styles.amount}>₹{parseFloat(item.amount_collected).toFixed(2)}</Text>
            </View>
            
            <View style={styles.infoRow}>
                <Text style={{ fontWeight: 'bold' }}>
                    {executiveNames[item.executive_id] || `Executive ${item.executive_id}`}
                </Text>
                <Text style={styles.status}>{item.status.toUpperCase()}</Text>
            </View>

            <Text style={styles.infoValue}>{item.method.charAt(0).toUpperCase() + item.method.slice(1)}</Text>

            <Text style={styles.info}>Collected At:
                <Text style={styles.date}> {new Date(item.collected_at).toLocaleDateString('en-IN')}</Text>
            </Text>

            {item.next_promise_date && (
                <Text style={styles.info}>Next Promise Date: 
                    <Text style={styles.infoValue}> {new Date(item.next_promise_date).toLocaleDateString('en-IN')}</Text>
                </Text>
            )}
            
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.info}>Location Verified: </Text>
                {item.exec_location_verified ? (
                    <Ionicons name="checkmark-circle" size={16} color="#1aa37a" />
                ) : (
                    <Ionicons name="close-circle" size={16} color="#e25656" />
                )}
            </View>

            <View style={styles.amountRow}>
                <TouchableOpacity 
                    style={styles.rejectBtn} 
                    onPress={() => handleReject(item)}
                    disabled={submitting}
                >
                    <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.approveBtn} 
                    onPress={() => handleApprove(item)}
                    disabled={submitting}
                >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#184977" />
                <Text style={styles.loadingText}>Loading approvals...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search and Refresh */}
            <View style={styles.topRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Company or Executive"
                    placeholderTextColor="#b2b2b2"
                    value={search}
                    onChangeText={setSearch}
                />
                <TouchableOpacity 
                    style={styles.refreshBtn} 
                    onPress={onRefresh}
                    disabled={refreshing}
                >
                    <Ionicons 
                        name="refresh" 
                        size={20} 
                        color="#184977" 
                        style={refreshing ? { opacity: 0.5 } : {}}
                    />
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredItems}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {search ? "No matching approvals found." : "No pending approvals."}
                    </Text>
                }
                contentContainerStyle={{ paddingBottom: 30 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#184977']}
                        tintColor="#184977"
                    />
                }
            />

            {/* Modal for approve/reject with comment box */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>
                            {modalAction === "approve" ? "Approve Payment" : "Reject Payment"}
                        </Text>
                        <Text style={styles.modalSub}>
                            {modalItem ? `Company: ${modalItem.company_code}, Amount: ₹${parseFloat(modalItem.amount_collected).toFixed(2)}` : ""}
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={modalComment}
                            onChangeText={setModalComment}
                            placeholder="Add a comment..."
                            multiline
                            editable={!submitting}
                        />
                        <TouchableOpacity 
                            style={[styles.submitBtn, submitting && styles.disabledBtn]} 
                            onPress={handleModalSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Submit</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={styles.closeBtn} 
                            onPress={() => setModalVisible(false)}
                            disabled={submitting}
                        >
                            <Ionicons name="close-circle" size={28} color="#e25757" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const circleBtnStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f8fa",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
    borderWidth: 1,
    borderColor: "#e2e8f4"
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafd",
        padding: 16
    },
    centered: {
        justifyContent: "center",
        alignItems: "center"
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#184977",
        fontWeight: "600"
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16
    },
    searchInput: {
        flex: 1,
        borderColor: "#b2d9e8",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        backgroundColor: "#fff",
        fontSize: 16,
        marginRight: 10
    },
    refreshBtn: {
        ...circleBtnStyle,
        backgroundColor: "#fff",
        borderColor: "#b2d9e8"
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 15,
        marginBottom: 15,
        shadowColor: "#b4dcea",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.11,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#e6f2fb"
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4
    },
    company: {
        fontSize: 15,
        fontWeight: "700",
        color: "#215087"
    },
    date: {
        fontSize: 13,
        color: "#888",
        marginLeft: 2,
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center"
    },
    exec: {
        fontSize: 14,
        color: "#184977"
    },
    status: {
        fontSize: 13,
        color: "#aa8603",
        fontWeight: "bold"
    },
    info: {
        fontSize: 13,
        color: "#444",
        marginBottom: 2,
        marginTop: 2
    },
    infoValue: {
        color: "#2279d2",
        fontWeight: "600"
    },
    amountRow: {
        marginTop: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end"
    },
    amount: {
        fontSize: 18,
        fontWeight: "700",
        color: "#189A7D",
        marginRight: 1,
        marginLeft: "auto"
    },
    circleBtn: {
        ...circleBtnStyle
    },
    empty: {
        color: "#8e99b6",
        fontSize: 16,
        textAlign: "center",
        marginTop: 35
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(10,20,40,0.18)",
        justifyContent: "center",
        alignItems: "center"
    },
    modalBox: {
        width: "90%",
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 22,
        alignItems: "center",
        position: "relative"
    },
    modalTitle: {
        fontWeight: "800",
        fontSize: 17,
        color: "#184977",
        marginBottom: 4
    },
    modalSub: {
        fontSize: 15,
        color: "#215087",
        marginBottom: 12
    },
    modalInput: {
        borderColor: "#b2d9e8",
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: "#f8fafd",
        padding: 14,
        fontSize: 16,
        color: "#184977",
        width: "100%",
        height: 90,
        marginBottom: 18
    },
    submitBtn: {
        backgroundColor: "#1f75fe",
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 35,
        alignItems: "center",
        marginBottom: 6
    },
    disabledBtn: {
        opacity: 0.6
    },
    closeBtn: {
        position: "absolute",
        top: 12,
        right: 12
    },
    approveBtn: {
        width: 64,
        height: 32,
        backgroundColor: "#1aa37a",
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: 2,
    },
    rejectBtn: {
        width: 64,
        height: 32,
        backgroundColor: "#e25656",
        borderRadius: 6,
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: 2,
    }
});