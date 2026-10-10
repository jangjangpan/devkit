package com.devkit.conn;

import com.devkit.config.SecretProvider;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 연결 비밀번호 등 민감 값을 AES-256-GCM으로 암호화/복호화한다.
 * 키는 SecretProvider가 해석한 시크릿(설치별 고유)을 SHA-256 한 32바이트.
 * 저장 형식: "enc:" + base64(iv(12) || ciphertext+tag). "enc:" 가 아니면 평문(레거시)로 간주.
 *
 * 복호화는 현재 키 → 레거시 키 순으로 시도한다(구버전 공개 기본 시크릿으로 저장된 기존 값 호환).
 */
@Component
public class CryptoUtil {

    private static final String PREFIX = "enc:";
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;
    private final SecretKeySpec key;        // 현재(설치별) 키 — 암호화/복호화 1순위
    private final SecretKeySpec legacyKey;  // 구버전 공개 기본 시크릿 키 — 복호화 폴백
    private final SecureRandom rng = new SecureRandom();

    public CryptoUtil(SecretProvider secrets) {
        this.key = deriveKey(secrets.cryptoSecret());
        this.legacyKey = deriveKey(SecretProvider.LEGACY_SECRET);
    }

    private static SecretKeySpec deriveKey(String secret) {
        try {
            byte[] k = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
            return new SecretKeySpec(k, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("CryptoUtil 키 생성 실패", e);
        }
    }

    public String encrypt(String plain) {
        if (plain == null || plain.isEmpty()) return plain;
        try {
            byte[] iv = new byte[IV_LEN];
            rng.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("암호화 실패", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || stored.isEmpty()) return stored;
        if (!stored.startsWith(PREFIX)) return stored; // 레거시 평문
        byte[] all = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
        byte[] iv = new byte[IV_LEN];
        System.arraycopy(all, 0, iv, 0, IV_LEN);
        byte[] ct = new byte[all.length - IV_LEN];
        System.arraycopy(all, IV_LEN, ct, 0, ct.length);
        // 현재 키 → 레거시 키 순으로 시도 (구버전 공개 기본 시크릿으로 저장된 기존 값 호환)
        try {
            return decryptWith(key, iv, ct);
        } catch (Exception primaryFail) {
            try {
                return decryptWith(legacyKey, iv, ct);
            } catch (Exception legacyFail) {
                throw new IllegalStateException("복호화 실패", primaryFail);
            }
        }
    }

    private String decryptWith(SecretKeySpec k, byte[] iv, byte[] ct) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(TAG_BITS, iv));
        return new String(c.doFinal(ct), StandardCharsets.UTF_8);
    }
}
