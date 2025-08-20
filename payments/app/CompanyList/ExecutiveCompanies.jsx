import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';

export default function CompaniesScreen() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterLabel, setFilterLabel] = useState('Overdue Amount (High to Low)');

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${process.env.EXPO_PUBLIC_API_BASE_URL}/companies/?search=${encodeURIComponent(search)}&skip=0&limit=100`
            );
            const data = await res.json();
            console.log(data)
            setCompanies(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    const renderItem = ({ item }) => (
        <TouchableOpacity style={styles.card}>
            <Text style={styles.companyName}>{item.name}</Text>
            <Text style={styles.amount}>₹{item.overdue_amount?.toLocaleString()}</Text>
            <Text style={styles.code}>Code: {item.code}</Text>
            <Text style={styles.executive}>👤 {item.executive_name}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Dashboard</Text>
                <View style={styles.headerButtons}>
                    <TouchableOpacity style={styles.headerBtn}>
                        <Text style={styles.headerBtnText}>Filters 🔽</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={fetchCompanies}>
                        <Text style={styles.headerBtnText}>Refresh ⟳</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filter Info */}
            <View style={styles.filterInfo}>
                <Text style={styles.filterText}>Sorted by: {filterLabel}</Text>
            </View>

            {/* Search */}
            <TextInput
                style={styles.search}
                placeholder="Search companies..."
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={fetchCompanies}
            />

            {/* List */}
            {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={companies}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 15
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom:10
    },
    title: {
        fontSize: 22,
        fontWeight: '700'
    },
    headerButtons: {
        flexDirection: 'row'
    },
    headerBtn: {
        borderColor: '#007AFF',
        backgroundColor:"#cccccc",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginLeft: 8,
    },
    headerBtnText: {
        color: 'black',
        fontWeight: '600'
    },
    filterInfo: {
        marginVertical: 10,
        padding: 8,
        backgroundColor: '#f1f5f9',
        borderRadius: 6,
        marginBottom:10
    },
    filterText: {
        color: '#007AFF',
        fontWeight: '500'
    },
    search: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    companyName: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000'
    },
    code: {
        fontSize: 14,
        color: '#666',
        marginTop: 4
    },
    executive: {
        fontSize: 14,
        color: '#444',
        marginTop: 2
    },
});
