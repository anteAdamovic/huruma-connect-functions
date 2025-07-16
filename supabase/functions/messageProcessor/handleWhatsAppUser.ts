// handleWhatsAppUser.ts
import { supabase } from './supabaseClient.ts';
/**
 * Handles a WhatsApp user by checking if they exist in the database
 * If they exist, returns their data
 * If not, creates a new user record and returns that data
 * 
 * @param phoneNumber - The WhatsApp phone number (from field)
 * @returns The user data and any error that occurred
 */ export async function handleWhatsAppUser(phoneNumber: string, name?: string) {
  try {
    // First, check if the user exists
    const { data: existingUser, error: fetchError } = await supabase.from('whatsapp_users').select('*').eq('phone_number', phoneNumber).single();
    // If there was no error, the user exists - return their data
    if (!fetchError && existingUser) {
      console.log(`Found existing WhatsApp user: ${phoneNumber}`);
      return {
        user: existingUser,
        isNewUser: false,
        error: null
      };
    }
    // If error is not "No rows found" or some other error occurred, return it
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`Error fetching WhatsApp user: ${fetchError.message}`);
      return {
        user: null,
        isNewUser: false,
        error: fetchError
      };
    }
    // User doesn't exist, create a new one
    const timestamp = new Date().toISOString();
    const { data: newUser, error: insertError } = await supabase.from('whatsapp_users').insert({
      phone_number: phoneNumber,
      created_at: timestamp,
      onboarding_type: 'INBOUND',
      name
    }).select().single();
    if (insertError) {
      console.error(`Error creating WhatsApp user: ${insertError.message}`);
      return {
        user: null,
        isNewUser: false,
        error: insertError
      };
    }
    console.log(`Created new WhatsApp user: ${phoneNumber}`);
    return {
      user: newUser,
      isNewUser: true,
      error: null
    };
  } catch (error) {
    console.error('Unexpected error in handleWhatsAppUser:', error);
    return {
      user: null,
      isNewUser: false,
      error
    };
  }
}
