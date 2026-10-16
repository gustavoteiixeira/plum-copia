import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingScreen from '../screens/OnboardingScreen';
import HomeScreen from '../screens/HomeScreen';
import GuardaRoupaScreen from '../screens/GuardaRoupaScreen';
import ChatPlumScreen from '../screens/ChatPlumScreen';
import CadastrarPecaScreen from '../screens/CadastrarPecaScreen';
import UsuarioLoginScreen from '../screens/UsuarioLoginScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRoute }) {
  return (
    <NavigationContainer>
      <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
              headerShown:false
          }}
      >

        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
        />

        <Stack.Screen
        name="UsuarioLogin"
        component={UsuarioLoginScreen}
        />

        <Stack.Screen
          name="Home"
          component={HomeScreen}
        />

        <Stack.Screen
            name="Perfil"
            component={PerfilScreen}
        />

        <Stack.Screen
          name="GuardaRoupa"
          component={GuardaRoupaScreen}
        />

        <Stack.Screen
          name="ChatPlum"
          component={ChatPlumScreen}
        />

        <Stack.Screen
          name="CadastrarPeca"
          component={CadastrarPecaScreen}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}