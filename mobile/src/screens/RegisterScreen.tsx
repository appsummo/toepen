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

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await register(username.trim(), password, displayName.trim() || undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Registreren mislukt');
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
            <Wordmark size={28} />
            <Text style={styles.tagline}>Maak een account aan</Text>
          </View>

          <View style={styles.form}>
            <Field
              label="Gebruikersnaam"
              value={username}
              onChangeText={setUsername}
              placeholder="min. 3 tekens"
              autoCorrect={false}
            />
            <Field
              label="Weergavenaam (optioneel)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="hoe je aan tafel heet"
            />
            <Field
              label="Wachtwoord"
              value={password}
              onChangeText={setPassword}
              placeholder="min. 6 tekens"
              secureTextEntry
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              title="Account aanmaken"
              onPress={submit}
              loading={busy}
              disabled={username.trim().length < 3 || password.length < 6}
            />
          </View>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.switch}>
            <Text style={styles.switchText}>
              Al een account? <Text style={styles.switchLink}>Inloggen</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 24 },
  header: { alignItems: 'center', gap: 8 },
  tagline: { color: colors.goldSoft, fontSize: 16 },
  form: { gap: 14 },
  error: { color: colors.redBright, fontSize: 14 },
  switch: { alignItems: 'center' },
  switchText: { color: colors.parchment, opacity: 0.85 },
  switchLink: { color: colors.goldSoft, fontWeight: '700' },
});
