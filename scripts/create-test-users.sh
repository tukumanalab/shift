#!/bin/bash

# Create test users using Supabase API
echo "Creating test users..."

SUPABASE_URL="http://localhost:54321"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

# Function to create a user
create_user() {
    local email=$1
    local name=$2
    local is_admin=$3
    
    echo "Creating user: $email"
    
    # Create user via API
    response=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
        -H "apikey: $SERVICE_KEY" \
        -H "Authorization: Bearer $SERVICE_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"password\",
            \"email_confirm\": true,
            \"user_metadata\": {\"name\": \"$name\"}
        }")
    
    # Extract user ID
    user_id=$(echo $response | grep -o '"id":"[^"]*' | grep -o '[^"]*$' | head -1)
    
    if [ ! -z "$user_id" ]; then
        echo "Created user with ID: $user_id"
        
        # Set admin flag if needed
        if [ "$is_admin" = "true" ]; then
            psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "
                UPDATE public.users SET is_admin = true WHERE id = '$user_id';
            "
            echo "Set admin flag for $email"
        fi
    else
        echo "Failed to create user: $email"
        echo "Response: $response"
    fi
}

# Create test users
create_user "admin@example.com" "管理者" "true"
create_user "user1@example.com" "田中太郎" "false"
create_user "user2@example.com" "佐藤花子" "false"

echo "Test users created successfully!"
echo ""
echo "You can now login with:"
echo "  admin@example.com / password (Admin)"
echo "  user1@example.com / password"
echo "  user2@example.com / password"