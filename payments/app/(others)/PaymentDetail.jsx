import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { StorageService } from "../../src/services/storageService"
import { useRouter } from "expo-router";

const token = StorageService.getToken()
const userRole = "executive"

// Mock data 
const mockPaymentHistory = [
    {
        amount: "3,000.00",
        payment_status: "success",
        collected_at: "2025-08-01 11:32",
        method: "Cash",
        accountant_comment: "Received by executive on site.",
        admin_comment: "Verified, good job.",
        exec_location_verified: true,
    },
    {
        amount: "2,000.00",
        payment_status: "pending",
        collected_at: "2025-08-07 15:01",
        method: "UPI",
        accountant_comment: "Payment awaiting confirmation.",
        admin_comment: null,
        exec_location_verified: false,
    },
    {
        amount: "5,500.00",
        payment_status: "success",
        collected_at: "2025-08-04 19:09",
        method: "Bank Transfer",
        accountant_comment: null,
        admin_comment: "Achha Laude",
        exec_location_verified: true,
    },
];

export default function PaymentDetails() {
    const { name, code, amount, outbal, bill_number } = useLocalSearchParams(); // Passed from bills list
    const [expandedIdx, setExpandedIdx] = useState(null);

    const router = useRouter();

    // (In real usage, fetch payment history items from API by bill_number in useEffect)

    const renderDropdown = (item, idx) => (
        <TouchableOpacity
            onPress={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            activeOpacity={0.7}
            style={styles.dropdownToggle}
        >
            <Text style={styles.dropTitle}>Comments ▼</Text>
            {expandedIdx === idx && (
                <View style={styles.dropContent}>
                    <Text style={styles.commentLabel}>Accountant:</Text>
                    <Text style={styles.commentValue}>{item.accountant_comment || "None"}</Text>
                    <Text style={[styles.commentLabel, { marginTop: 8 }]}>Admin:</Text>
                    <Text style={styles.commentValue}>{item.admin_comment || "None"}</Text>
                    <Text style={[styles.commentLabel, { marginTop: 8 }]}>Executive Location Verified:</Text>
                    <Text style={styles.commentValue}>
                        {item.exec_location_verified === undefined ? "N/A" : item.exec_location_verified ? "Yes" : "No"}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );

    const renderPaymentItem = ({ item, index }) => (
        <View style={styles.billCard} >
            <View style={styles.row}>
                <Text style={styles.billNumber}>₹{item.amount}</Text>
                <Text style={[styles.status, statusColor(item.payment_status)]}>{item.payment_status.toUpperCase()}</Text>
            </View>

            <Text style={styles.label}>Date: <Text style={styles.value}>{item.collected_at}</Text></Text>
            <Text style={[styles.label]}>Method: <Text style={[styles.value]}>{item.method}</Text></Text>

            {renderDropdown(item, index)}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.companyBox}>
                <Text style={styles.compName}>{name}</Text>
                <View style={styles.row}>
                    <Text style={styles.code}>Code: {code}</Text>
                    <Text style={[styles.code, { marginLeft: 16 }]}>Bill: {bill_number}</Text>
                </View>

                <Text style={styles.label}>Amount: <Text style={[styles.amount, styles.value]}>{amount}</Text></Text>
                <Text style={styles.label}>Outbal: <Text style={[styles.outbal, styles.value]}>{outbal}</Text></Text>
            </View>

            <Text style={styles.title}>Payments</Text>
            <FlatList
                data={mockPaymentHistory}
                keyExtractor={(_, idx) => idx.toString()}
                renderItem={renderPaymentItem}
                ListEmptyComponent={<Text style={styles.empty}>No payments found.</Text>}
                contentContainerStyle={{ paddingBottom: 30 }}
            />

            {userRole === "executive" && (

                <TouchableOpacity style={[styles.button]} activeOpacity={0.5} onPress={() => router.push({
                    pathname: "./PaymentScreen",
                    params: { company_code: code }
                })}>
                    <Text style={styles.buttonText}>Update</Text>
                </TouchableOpacity>
            )}


        </View>


    );
}

// Helper for status coloring
function statusColor(status) {
    switch (status) {
        case "pending":
            return { backgroundColor: "#ffe3e3", color: "#d73838" };
        case "success":
        case "paid":
            return { backgroundColor: "#e9f8ed", color: "#209653" };
        default:
            return {};
    }
}

// --- Reuse & extend your stylesheet ---

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
        fontSize: 22,
        fontWeight: "800",
        color: "#184977",
        marginBottom: 5
    },
    code: {
        fontSize: 15,
        color: "#3D7CA6",
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
        color: "#37ad8f",
        fontWeight: "700"
    },
    outbal: {
        color: "#db5151",
        marginLeft: 21,
        fontWeight: "700"
    },
    value: {
        fontSize: 15,
        fontWeight: "500"
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
        color: "#215087",
        marginBottom: 6
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
        marginTop: 10,
        padding: 8,
        backgroundColor: "#f2f6fa",
        borderRadius: 10,
    },
    dropTitle: {
        fontWeight: "700",
        color: "#215087",
        fontSize: 14,
    },
    dropContent: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
    commentLabel: {
        color: "#354c68",
        fontWeight: "700",
        fontSize: 13,
    },
    commentValue: {
        color: "#4f6480",
        fontSize: 13,
        fontWeight: "500",
        marginTop: 2,
    },
    empty: {
        textAlign: "center",
        color: "#8e99b6",
        fontSize: 15,
        padding: 35,
    },
    button: {
        backgroundColor: "#007BFF",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: "auto",
        marginBottom: 45
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});
