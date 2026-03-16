

# Configure OPENAI_API_KEY Secret

## Security Warning
The API key was shared in plain text. **Rotate the key in the OpenAI dashboard immediately** and provide the new key when prompted by the secret configuration tool.

## Action
Use the `add_secret` tool to configure `OPENAI_API_KEY` as a runtime secret, accessible to all edge functions via `Deno.env.get("OPENAI_API_KEY")`.

Single tool call, no code changes, no other modifications.

