import type { DeviceInfo, PackageInfo } from './adb-client'

export const MOCK_DEVICE_INFO: DeviceInfo = {
    model: 'Pixel 7 Pro (DEMO)',
    manufacturer: 'Google',
    androidVersion: '14',
    apiLevel: '34',
    serialNumber: 'DEMO-MODE-12345',
    batteryLevel: 85,
    batteryStatus: 'Discharging',
    screenResolution: '1440x3120',
    screenDensity: '560',
    isRooted: false,
}

export const MOCK_PACKAGES: PackageInfo[] = [
    { packageName: 'com.google.android.youtube', apkPath: '/system/app/YouTube/YouTube.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.google.android.apps.maps', apkPath: '/system/app/Maps/Maps.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.facebook.katana', apkPath: '/data/app/facebook/base.apk', isEnabled: true, isSystem: false },
    { packageName: 'com.instagram.android', apkPath: '/data/app/instagram/base.apk', isEnabled: true, isSystem: false },
    { packageName: 'com.whatsapp', apkPath: '/data/app/whatsapp/base.apk', isEnabled: true, isSystem: false },
    { packageName: 'com.android.chrome', apkPath: '/system/app/Chrome/Chrome.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.google.android.gm', apkPath: '/system/app/Gmail/Gmail.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.google.android.apps.photos', apkPath: '/system/app/Photos/Photos.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.netflix.mediaclient', apkPath: '/data/app/netflix/base.apk', isEnabled: true, isSystem: false },
    { packageName: 'com.spotify.music', apkPath: '/data/app/spotify/base.apk', isEnabled: true, isSystem: false },
    { packageName: 'com.amazon.mShop.android.shopping', apkPath: '/data/app/amazon/base.apk', isEnabled: true, isSystem: false },
    { packageName: 'com.google.android.calendar', apkPath: '/system/app/Calendar/Calendar.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.google.android.contacts', apkPath: '/system/app/Contacts/Contacts.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.google.android.apps.messaging', apkPath: '/system/app/Messages/Messages.apk', isEnabled: true, isSystem: true },
    { packageName: 'com.google.android.dialer', apkPath: '/system/app/Phone/Phone.apk', isEnabled: true, isSystem: true },
]
