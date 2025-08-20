import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
} from "react-native";

// Dummy DB
const users = [
    { username: "d", password: "123", phone: "12" },
    { username: "Alice Brown", phone: "9123456789", password: "abcdef" },
];

export default function EditUserFindScreen() {
    const router = useRouter()
    const [input, setInput] = useState("");
    const [error, setError] = useState("");

    const handleSearch = () => {
        const foundUser = users.find(
            (user) => user.name === input || user.phone === input
        );

        if (foundUser) {
            setError("");
            router.push({
                pathname: "../(others)/EditUserScreen",
                params: { uphone: foundUser.phone, uname: foundUser.username, upassword: foundUser.password },
            });
        } else {
            setError("❌ User not found. Try again.");
        }
    };
    return (
        <KeyboardAvoidingView style={styles.container} behavior="padding">
            <Text style={styles.title}>Find User</Text>

            <TextInput
                placeholder="Enter username or phone"
                value={input}
                onChangeText={setInput}
                style={styles.input}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.button} onPress={handleSearch}>
                <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: "center",
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 22,
        fontWeight: "600",
        marginBottom: 20,
        textAlign: "center",
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
        marginTop: 10,
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