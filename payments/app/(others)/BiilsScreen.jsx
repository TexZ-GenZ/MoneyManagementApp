import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router"

// Mock bills data
const mockBills = [
    {
        bill_number: "BILL-001",
        bill_date: "2025-08-01",
        due_date: "2025-08-15",
        amount: "8,000.00",
        amount_paid: "5,000.00",
        status: "partial"
    },
    {
        bill_number: "BILL-002",
        bill_date: "2025-08-05",
        due_date: "2025-08-18",
        amount: "5,700.00",
        amount_paid: "0.00",
        status: "pending"
    },
    {
        bill_number: "BILL-003",
        bill_date: "2025-07-25",
        due_date: "2025-08-10",
        amount: "6,500.00",
        amount_paid: "6,500.00",
        status: "paid"
    }
];

export default function CompanyBillsList() {
    const { name, code, amount, outbal } = useLocalSearchParams();
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);

    const router = useRouter();

    useEffect(() => {
        fetchBills();
    }, []);

    const fetchBills = async () => {
        setLoading(true);
        // Replace with your real API fetch logic.
        await new Promise(res => setTimeout(res, 400));
        setBills(mockBills);
        setLoading(false);
    };

    const renderBillItem = ({ item }) => (
        <TouchableOpacity style={styles.billCard} activeOpacity={0.4} onPress={() => router.push({
            pathname: "./PaymentDetail",
            params: {name, code, amount, outbal, bill_number: item.bill_number, bill_date: item.bill_date, due_date: item.due_date, status: item.status, amount_paid: item.amount_paid}
        })}>
            <View style={styles.row}>
                <Text style={styles.billNumber}>{item.bill_number}</Text>
                <Text style={[styles.status, billStatusColor(item.status)]}>{item.status.toUpperCase()}</Text>
            </View>

            <Text style={styles.label}>Bill Date: <Text style={styles.value}>{item.bill_date}</Text></Text>
            <Text style={[styles.label]}>Due Date: <Text style={styles.value}>{item.due_date}</Text></Text>


            <Text style={styles.label}>Amount: <Text style={[styles.value, { color: "black" }]}>{item.amount}</Text></Text>
            <Text style={[styles.label]}>Paid: <Text style={[styles.value, { color: "#189A7D", fontWeight:'500' }]}>{item.amount_paid}</Text></Text>

        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.companyBox}>
                <Text style={styles.compName}>{name}</Text>
                <View style={styles.row}>
                    <Text style={styles.code}>Code: {code}</Text>
                </View>

                <Text style={styles.label}>Amount: <Text style={[styles.amount, styles.value]}>{amount}</Text></Text>
                <Text style={[styles.label]}>Outbal: <Text style={[styles.outbal, styles.value]}>{outbal}</Text></Text>

            </View>
            <Text style={styles.title}>Bills</Text>
            {loading ? (
                <ActivityIndicator color="#1f75fe" size="large" style={{ marginTop: 22 }} />
            ) : (
                <FlatList
                    data={bills}
                    keyExtractor={item => item.bill_number}
                    renderItem={renderBillItem}
                    ListEmptyComponent={<Text style={styles.empty}>No bills found.</Text>}
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
            return {};
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
        fontWeight: "500"
    },
    outbal: {
        color: "#db5151",
        marginLeft: 21,
        fontWeight: "700"
    },
    value: {
        fontSize: 15,
        fontWeight: "400"
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
        fontSize: 15,
        color: "#123651",
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
    empty: {
        textAlign: "center",
        color: "#8e99b6",
        fontSize: 15,
        padding: 35,
    }
});
