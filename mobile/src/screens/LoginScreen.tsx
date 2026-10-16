import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Field, Wordmark } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import { ApiError } from '../api/client';
import type { AuthScreenProps } from '../navigation/types';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Inloggen mislukt');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Wordmark size={30} />
            <Text style={styles.tagline}>Zoals vroeger aan de stamtafel</Text>
          </View>

          <View style={styles.form}>
            <Field
              label="Gebruikersnaam"
              value={username}
              onChangeText={setUsername}
              placeholder="jouw naam"
              autoCorrect={false}
            />
            <Field
              label="Wachtwoord"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              secureTextEntry
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              title="Inloggen"
              onPress={submit}
              loading={busy}
              disabled={!username.trim() || !password}
            />
          </View>

          <Pressable onPress={() => navigation.navigate('Register')} style={styles.switch}>
            <Text style={styles.switchText}>
              Nog geen account? <Text style={styles.switchLink}>Registreren</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 28 },
  header: { alignItems: 'center', gap: 8 },
  tagline: { color: colors.goldSoft, fontSize: 16 },
  form: { gap: 16 },
  error: { color: colors.redBright, fontSize: 14 },
  switch: { alignItems: 'center' },
  switchText: { color: colors.parchment, opacity: 0.85 },
  switchLink: { color: colors.goldSoft, fontWeight: '700' },
});
