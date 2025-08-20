import { Text, StyleSheet, KeyboardAvoidingView, TextInput, TouchableOpacity, Alert } from 'react-native'
import { useState } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"

export default function EditUserScreen() {
    const router = useRouter()
    const { uphone, uname, upassword } = useLocalSearchParams()
    const [name, setName] = useState(uname);
    const [phone, setPhone] = useState(uphone);
    const [password, setPassword] = useState(upassword);

    const handleUpdate = () => {
        Alert.alert("✅ Success", "User details updated!");
        // you could add API call here
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior="padding">
            <Text style={styles.title}>Edit Profile</Text>

            <Text style={styles.label}>Username</Text>
            <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="Full Name"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
                value={phone}
                onChangeText={setPhone}
                style={styles.input}
                placeholder="Phone"
                keyboardType="phone-pad"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder="Password"
                secureTextEntry
            />

            <TouchableOpacity style={styles.button} onPress={handleUpdate}>
                <Text style={styles.buttonText}>Update</Text>
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 22,
        fontWeight: "600",
        marginBottom: 20,
        textAlign: "center",
    },
    label: {
        fontSize: 14,
        fontWeight: "500",
        marginBottom: 5,
        marginLeft: 2,
        color: "#333",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
    },
    button: {
        backgroundColor: "#007BFF",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
        marginTop: "auto",
        marginBottom: 50
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    error: {
        color: "red",
        marginBottom: 10,
        textAlign: "center",
    },
});
