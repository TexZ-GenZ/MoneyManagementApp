import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Mock executiveId to name mapping
const executiveNames = {
    0: "Test Exec",
    1: "Alice",
    2: "Bob",
    3: "Charlie"
};

// Mocked admin approval data
const mockAdminApprovalItems = [
    {
        id: 1,
        company_code: "ABC-001",
        collected_at: "2025-08-22T03:25:48.172Z",
        amount_collected: "8550",
        method: "Bank Transfer",
        status: "pending",
        executive_id: 1,
        next_promise_date: "2025-08-28",
        exec_location_verified: true
    },
    {
        id: 2,
        company_code: "XYZ-002",
        collected_at: "2025-08-20T15:00:12.755Z",
        amount_collected: "2400",
        method: "UPI",
        status: "pending",
        executive_id: 2,
        next_promise_date: "2025-08-29",
        exec_location_verified: false
    }
];

export default function AdminApprovalScreen() {
    const [search, setSearch] = useState("");
    const [approvalItems, setApprovalItems] = useState(mockAdminApprovalItems);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalAction, setModalAction] = useState(null); // "approve" or "reject"
    const [modalItem, setModalItem] = useState(null);
    const [modalComment, setModalComment] = useState("");

    const filteredItems = approvalItems.filter(item =>
        item.company_code.toLowerCase().includes(search.toLowerCase()) ||
        (executiveNames[item.executive_id] || "").toLowerCase().includes(search.toLowerCase())
    );

    const handleApprove = (item) => {
        setModalAction("approve");
        setModalItem(item);
        setModalComment("");
        setModalVisible(true);
    };

    const handleReject = (item) => {
        setModalAction("reject");
        setModalItem(item);
        setModalComment("");
        setModalVisible(true);
    };

    const handleModalSubmit = () => {
        setModalVisible(false);
        alert(`${modalAction === "approve" ? "Approved" : "Rejected"} payment ID ${modalItem.id} with comment: ${modalComment}`);
        // Integrate your API logic here
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.company}>{item.company_code}</Text>

                <Text style={styles.amount}>₹{item.amount_collected}</Text>

            </View>
            <View style={styles.infoRow}>
                <Text style={{ fontWeight: 'bold' }}>{executiveNames[item.executive_id] || item.executive_id}</Text>
                <Text style={styles.status}>{item.status.toUpperCase()}</Text>
            </View>

            <Text style={styles.infoValue}>{item.method}</Text>

            <Text style={styles.info}>Collected At:
                <Text style={styles.date}>{(new Date(item.collected_at)).toLocaleDateString()}</Text>
            </Text>

            <Text style={styles.info}>Next Promise Date: <Text style={styles.infoValue}>{item.next_promise_date}</Text></Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.info}>Location Verified: </Text>
                {item.exec_location_verified ?
                    <Ionicons name="checkmark-circle" size={16} color="#1aa37a" /> :
                    <Ionicons name="close-circle" size={16} color="#e25656" />}
            </View>


            <View style={styles.amountRow}>


                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
                    <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>

            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Search and Refresh */}
            <View style={styles.topRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by Name"
                    placeholderTextColor="#b2b2b2"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <FlatList
                data={filteredItems}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.empty}>No approvals found.</Text>}
                contentContainerStyle={{ paddingBottom: 30 }}
            />

            {/* Modal for approve/reject with comment box */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>
                            {modalAction === "approve" ? "Approve Payment" : "Reject Payment"}
                        </Text>
                        <Text style={styles.modalSub}>
                            {modalItem ? `Company: ${modalItem.company_code}, Amount: ₹${modalItem.amount_collected}` : ""}
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            value={modalComment}
                            onChangeText={setModalComment}
                            placeholder="Add a comment..."
                            multiline
                        />
                        <TouchableOpacity style={styles.submitBtn} onPress={handleModalSubmit}>
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Submit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
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
