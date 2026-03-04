import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
} from 'react-native';
import {
    Switch,
    Text,
    Card,
    Divider,
} from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const VAULT_KEY = 'jan_sahayak_vault';

// Document definitions with display names, keys (matching backend), and icons
const DOCUMENTS = [
    { key: 'aadhar_card', label: 'Aadhar Card', icon: 'id-card-outline', description: 'UIDAI Identity Proof' },
    { key: 'land_record_7_12', label: 'Land Record (7/12)', icon: 'map-outline', description: 'Revenue & Land Records' },
    { key: 'caste_certificate', label: 'Caste Certificate', icon: 'document-text-outline', description: 'SC/ST/OBC Certificate' },
    { key: 'bank_passbook', label: 'Bank Passbook', icon: 'wallet-outline', description: 'Bank Account Details' },
    { key: 'income_certificate', label: 'Income Certificate', icon: 'cash-outline', description: 'Family Income Proof' },
    { key: 'ration_card', label: 'Ration Card', icon: 'card-outline', description: 'PDS / BPL Card' },
    { key: 'previous_year_marksheet', label: 'Previous Year Marksheet', icon: 'school-outline', description: 'Academic Records' },
    { key: 'fee_receipt', label: 'Fee Receipt', icon: 'receipt-outline', description: 'Current Year Fee Receipt' },
    { key: 'education_certificate', label: 'Education Certificate', icon: 'ribbon-outline', description: 'Degree / Diploma' },
];

export default function VaultScreen() {
    const [vault, setVault] = useState({});

    // Load vault from AsyncStorage on mount
    useEffect(() => {
        loadVault();
    }, []);

    const loadVault = async () => {
        try {
            const stored = await AsyncStorage.getItem(VAULT_KEY);
            if (stored) {
                setVault(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Failed to load vault:', e);
        }
    };

    const toggleDocument = async (docKey) => {
        const updated = { ...vault, [docKey]: !vault[docKey] };
        setVault(updated);
        try {
            await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to save vault:', e);
        }
    };

    const possessedCount = Object.values(vault).filter(Boolean).length;

    return (
        <ScrollView style={styles.container}>
            {/* Summary Card */}
            <Card style={styles.summaryCard}>
                <Card.Content style={styles.summaryContent}>
                    <Ionicons name="shield-checkmark" size={32} color="#138808" />
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.summaryTitle}>Local Vault</Text>
                        <Text style={styles.summarySubtitle}>
                            {possessedCount} / {DOCUMENTS.length} documents stored
                        </Text>
                    </View>
                </Card.Content>
            </Card>

            <Text style={styles.sectionHint}>
                Toggle documents you have in your possession. This data stays on your device only.
            </Text>

            {/* Document List */}
            {DOCUMENTS.map((doc, index) => (
                <View key={doc.key}>
                    <Card style={[styles.docCard, vault[doc.key] && styles.docCardActive]}>
                        <Card.Content style={styles.docRow}>
                            <View style={styles.docIconContainer}>
                                <Ionicons
                                    name={doc.icon}
                                    size={28}
                                    color={vault[doc.key] ? '#138808' : '#9CA3AF'}
                                />
                            </View>
                            <View style={styles.docInfo}>
                                <Text style={[styles.docLabel, vault[doc.key] && styles.docLabelActive]}>
                                    {doc.label}
                                </Text>
                                <Text style={styles.docDescription}>{doc.description}</Text>
                            </View>
                            <Switch
                                value={!!vault[doc.key]}
                                onValueChange={() => toggleDocument(doc.key)}
                                color="#138808"
                            />
                        </Card.Content>
                    </Card>
                    {index < DOCUMENTS.length - 1 && <View style={{ height: 8 }} />}
                </View>
            ))}

            <View style={{ height: 30 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        padding: 16,
    },
    summaryCard: {
        backgroundColor: '#ECFDF5',
        borderRadius: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#138808',
    },
    summaryContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#064E3B',
    },
    summarySubtitle: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    sectionHint: {
        fontSize: 12,
        color: '#9CA3AF',
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    docCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        elevation: 1,
    },
    docCardActive: {
        borderLeftWidth: 3,
        borderLeftColor: '#138808',
    },
    docRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    docIconContainer: {
        width: 40,
        alignItems: 'center',
    },
    docInfo: {
        flex: 1,
        marginLeft: 12,
    },
    docLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    docLabelActive: {
        color: '#138808',
    },
    docDescription: {
        fontSize: 11,
        color: '#9CA3AF',
        marginTop: 1,
    },
});
