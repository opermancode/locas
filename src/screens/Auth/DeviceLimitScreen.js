/**
 * DeviceLimitScreen
 * 
 * Shown when user tries to login but has reached their device limit.
 * Allows them to remove a device to free up a slot.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../utils/Icon';
import { removeDevice } from '../../utils/licenseSystem';
import { getDeviceInfo } from '../../utils/deviceManager';
import { COLORS, RADIUS, FONTS } from '../../theme';

// Fallback colors in case theme doesn't have them
const THEME = {
  ...COLORS,
  warningBg: COLORS.warningBg || COLORS.warningLight || '#FFFBEB',
  dangerLight: COLORS.dangerLight || '#FEE2E2',
  primary: COLORS.primary || '#FF6B00',
  primaryLight: COLORS.primaryLight || '#FFF0E6',
};

export default function DeviceLimitScreen({ 
  license, 
  devices, 
  userId, 
  onDeviceRemoved, 
  onCancel 
}) {
  const insets = useSafeAreaInsets();
  const [removing, setRemoving] = useState(null);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  // Get current device ID on mount
  React.useEffect(() => {
    getDeviceInfo().then(info => setCurrentDeviceId(info.deviceId));
  }, []);

  const handleRemoveDevice = (device) => {
    // Can't remove current device from this screen
    if (device.id === currentDeviceId) {
      Alert.alert(
        'Cannot Remove',
        'You cannot remove the device you are currently using.',
      );
      return;
    }

    Alert.alert(
      'Remove Device',
      `Remove "${device.name}" from your account?\n\nThat device will be signed out and will need to log in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(device.id);
            try {
              await removeDevice(userId, device.id);
              Alert.alert('Device Removed', 'You can now continue on this device.');
              onDeviceRemoved();
            } catch (e) {
              Alert.alert('Error', 'Failed to remove device. Please try again.');
            } finally {
              setRemoving(null);
            }
          },
        },
      ],
    );
  };

  const formatLastSeen = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'android': return 'smartphone';
      case 'ios': return 'smartphone';
      case 'electron': return 'monitor';
      case 'web': return 'globe';
      default: return 'smartphone';
    }
  };

  const renderDevice = ({ item }) => {
    const isCurrentDevice = item.id === currentDeviceId;
    const isRemoving = removing === item.id;

    return (
      <View style={[styles.deviceCard, isCurrentDevice && styles.currentDevice]}>
        <View style={styles.deviceIcon}>
          <Icon 
            name={getPlatformIcon(item.platform)} 
            size={24} 
            color={isCurrentDevice ? COLORS.primary : COLORS.textSub} 
          />
        </View>
        
        <View style={styles.deviceInfo}>
          <View style={styles.deviceNameRow}>
            <Text style={styles.deviceName}>{item.name}</Text>
            {isCurrentDevice && (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>This device</Text>
              </View>
            )}
          </View>
          <Text style={styles.deviceMeta}>
            {item.platform} • Last seen {formatLastSeen(item.lastSeen)}
          </Text>
        </View>

        {!isCurrentDevice && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveDevice(item)}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <Icon name="x" size={18} color={COLORS.danger} />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Icon name="smartphone" size={32} color={COLORS.warning} />
        </View>
        <Text style={styles.title}>Device Limit Reached</Text>
        <Text style={styles.subtitle}>
          Your {license.plan === 'trial' ? 'free' : license.plan} plan allows{' '}
          <Text style={styles.bold}>{license.maxDevices} devices</Text>.
          {'\n'}Remove a device to continue on this one.
        </Text>
      </View>

      {/* Device count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {devices.length} / {license.maxDevices} devices used
        </Text>
      </View>

      {/* Device list */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={renderDevice}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Upgrade hint */}
      {license.plan === 'trial' && (
        <View style={styles.upgradeHint}>
          <Icon name="zap" size={16} color={COLORS.primary} />
          <Text style={styles.upgradeText}>
            Upgrade to Yearly for 5 devices + Cloud Sync
          </Text>
        </View>
      )}

      {/* Cancel button */}
      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelText}>Cancel & Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: insets.bottom + 20 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: FONTS.black,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 20,
  },
  bold: {
    fontWeight: FONTS.bold,
    color: COLORS.text,
  },
  countBar: {
    backgroundColor: COLORS.card,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  countText: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: COLORS.textSub,
  },
  list: {
    padding: 16,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentDevice: {
    borderColor: THEME.primary,
    backgroundColor: THEME.primaryLight,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: FONTS.semibold,
    color: COLORS.text,
  },
  currentBadge: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: FONTS.bold,
    color: '#fff',
    textTransform: 'uppercase',
  },
  deviceMeta: {
    fontSize: 12,
    color: COLORS.textMute,
  },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.primaryLight,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: FONTS.semibold,
    color: THEME.primary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginHorizontal: 16,
  },
  cancelText: {
    fontSize: 14,
    color: COLORS.textMute,
  },
});