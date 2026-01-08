import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import PrinterTab from './function/printer';
import DrugTab from './function/drug';
import GeneralTab from './function/general';

export default function ImageUpload() {
  const [activeTab, setActiveTab] = useState('printer');

  const switchTab = (tab) => {
    setActiveTab(tab);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'printer' && styles.tabActive]}
          onPress={() => switchTab('printer')}
        >
          <Text style={[styles.tabText, activeTab === 'printer' && styles.tabTextActive]}>
            识别打印机
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'medicine' && styles.tabActive]}
          onPress={() => switchTab('medicine')}
        >
          <Text style={[styles.tabText, activeTab === 'medicine' && styles.tabTextActive]}>
            识别药品
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'general' && styles.tabActive]}
          onPress={() => switchTab('general')}
        >
          <Text style={[styles.tabText, activeTab === 'general' && styles.tabTextActive]}>
            通用识别
          </Text>
        </TouchableOpacity>
      </View>
      {activeTab === 'printer' && <PrinterTab />}
      {activeTab === 'medicine' && <DrugTab />}
      {activeTab === 'general' && <GeneralTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#667eea',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
});

