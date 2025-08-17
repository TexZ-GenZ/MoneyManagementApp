import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS } from '../../utils/constants';

const ApiDebugScreen: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [`[${timestamp}] ${message}`, ...prev]);
    };

    const testAPI = async () => {
        setIsLoading(true);
        setLogs([]);

        try {
            addLog('🔍 Starting API connectivity test...');

            // Get the API base URL
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
            addLog(`📡 API Base URL: ${apiBaseUrl}`);

            // Test health endpoint
            const healthUrl = apiBaseUrl.replace('/api', '') + '/health';
            addLog(`🏥 Testing health endpoint: ${healthUrl}`);

            const healthResponse = await fetch(healthUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (healthResponse.ok) {
                const healthData = await healthResponse.json();
                addLog(`✅ Health check successful: ${JSON.stringify(healthData)}`);

                // Test login endpoint
                addLog('🔐 Testing login endpoint...');
                const loginResponse = await fetch(`${apiBaseUrl}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: 'admin@jaskirat.com',
                        password: 'admin123'
                    }),
                });

                if (loginResponse.ok) {
                    const loginData = await loginResponse.json();
                    addLog('✅ Login successful!');

                    // Test companies endpoint
                    addLog('🏢 Testing companies endpoint...');
                    const companiesResponse = await fetch(`${apiBaseUrl}/companies/`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${loginData.access_token}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    if (companiesResponse.ok) {
                        const companies = await companiesResponse.json();
                        addLog(`✅ Companies fetched: ${companies.length} companies`);
                        if (companies.length > 0) {
                            addLog(`📋 Sample company: ${companies[0].account_n} (${companies[0].code})`);
                        }
                    } else {
                        const companiesError = await companiesResponse.text();
                        addLog(`❌ Companies fetch failed: ${companiesResponse.status} - ${companiesError}`);
                    }
                } else {
                    const loginError = await loginResponse.text();
                    addLog(`❌ Login failed: ${loginResponse.status} - ${loginError}`);
                }
            } else {
                const healthError = await healthResponse.text();
                addLog(`❌ Health check failed: ${healthResponse.status} - ${healthError}`);
            }
        } catch (error: any) {
            addLog(`💥 Network error: ${error.message}`);
            addLog(`🔧 This might be a connectivity issue between your phone and the backend server`);
            addLog(`💡 Suggestions:`);
            addLog(`   1. Make sure your phone and computer are on the same Wi-Fi network`);
            addLog(`   2. Check if your computer's firewall is blocking port 8000`);
            addLog(`   3. Try using your computer's Wi-Fi IP instead of ${process.env.EXPO_PUBLIC_API_BASE_URL}`);
        }

        setIsLoading(false);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const copyLogsToClipboard = () => {
        const logsText = logs.join('\n');
        // In a real app, you'd use Clipboard.setString(logsText)
        Alert.alert('Logs', logsText);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>🔧 API Debug Console</Text>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.testButton]}
                    onPress={testAPI}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? '🔄 Testing...' : '🧪 Test API Connection'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.clearButton]}
                    onPress={clearLogs}
                >
                    <Text style={styles.buttonText}>🗑️ Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.copyButton]}
                    onPress={copyLogsToClipboard}
                >
                    <Text style={styles.buttonText}>📋 Show All</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.logsContainer}>
                {logs.length === 0 ? (
                    <Text style={styles.emptyText}>
                        Tap "Test API Connection" to start debugging
                    </Text>
                ) : (
                    logs.map((log, index) => (
                        <Text key={index} style={styles.logText}>
                            {log}
                        </Text>
                    ))
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 8,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    testButton: {
        backgroundColor: COLORS.primary,
    },
    clearButton: {
        backgroundColor: COLORS.SECONDARY,
    },
    copyButton: {
        backgroundColor: COLORS.WARNING,
    },
    buttonText: {
        color: COLORS.WHITE,
        fontWeight: 'bold',
        fontSize: 12,
    },
    logsContainer: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        padding: 12,
    },
    emptyText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 20,
    },
    logText: {
        color: COLORS.text,
        fontSize: 12,
        fontFamily: 'monospace',
        marginBottom: 4,
        lineHeight: 16,
    },
});

export default ApiDebugScreen;
