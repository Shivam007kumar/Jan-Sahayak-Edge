import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES = [
    { code: 'en-IN', label: 'English', native: 'English' },
    { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
    { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
    { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
    { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' }
];

export default function OnboardingScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [selectedLang, setSelectedLang] = useState('hi-IN');

    const handleVerify = async () => {
        setLoading(true);
        await AsyncStorage.setItem('appLanguage', selectedLang);
        setTimeout(() => {
            setLoading(false);
            navigation.replace('MainTabs');
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={64} color="#138808" />
                </View>
                <Text style={styles.title}>Jan-Sahayak</Text>
                <Text style={styles.subtitle}>Digital Sovereignty for Bharat</Text>
                <Text style={styles.description}>
                    Your AI Agent for Government Schemes. It understands you, plans the process, and autofills forms securely using your local digital vault.
                </Text>
            </View>

            {/* Language Picker */}
            <View style={styles.langSection}>
                <View style={styles.langHeader}>
                    <Ionicons name="globe-outline" size={16} color="#9CA3AF" />
                    <Text style={styles.langTitle}>SELECT LANGUAGE</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langRow}>
                    {LANGUAGES.map((lang) => {
                        const isActive = selectedLang === lang.code;
                        return (
                            <TouchableOpacity
                                key={lang.code}
                                style={[styles.langChip, isActive && styles.langChipActive]}
                                onPress={() => setSelectedLang(lang.code)}
                                activeOpacity={0.7}
                            >
                                {isActive && (
                                    <View style={styles.checkBadge}>
                                        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                                    </View>
                                )}
                                <Text style={[styles.langNative, isActive && styles.langNativeActive]}>
                                    {lang.native}
                                </Text>
                                <Text style={[styles.langLabel, isActive && styles.langLabelActive]}>
                                    {lang.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleVerify}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="chatbubbles" size={24} color="#FFFFFF" style={styles.btnIcon} />
                            <Text style={styles.buttonText}>Start Chatting</Text>
                        </>
                    )}
                </TouchableOpacity>
                <Text style={styles.secureText}>
                    <Ionicons name="lock-closed" size={12} color="#9CA3AF" /> Secure • Fast • Private
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    title: {
        fontSize: 36,
        fontWeight: '800',
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#138808',
        marginBottom: 24,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 24,
    },
    // Language Picker
    langSection: {
        paddingHorizontal: 24,
        marginBottom: 16,
    },
    langHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12,
    },
    langTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9CA3AF',
        letterSpacing: 1.5,
    },
    langRow: {
        gap: 10,
        paddingHorizontal: 4,
    },
    langChip: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        minWidth: 80,
    },
    langChipActive: {
        borderColor: '#138808',
        backgroundColor: '#F0FDF4',
    },
    checkBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#138808',
        alignItems: 'center',
        justifyContent: 'center',
    },
    langNative: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4B5563',
        marginBottom: 2,
    },
    langNativeActive: {
        color: '#138808',
    },
    langLabel: {
        fontSize: 10,
        fontWeight: '500',
        color: '#9CA3AF',
    },
    langLabelActive: {
        color: '#16A34A',
    },
    // Footer
    footer: {
        padding: 32,
        paddingBottom: 48,
    },
    button: {
        backgroundColor: '#138808',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 16,
        shadowColor: '#138808',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    btnIcon: {
        marginRight: 12,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    secureText: {
        textAlign: 'center',
        marginTop: 16,
        color: '#9CA3AF',
        fontSize: 12,
        fontWeight: '500',
    },
});
