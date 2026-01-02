import os
import uuid
import requests
from openai import AsyncOpenAI
from app.config import config
from app.tool.base import BaseTool, ToolResult

class GenerateImageTool(BaseTool):
    name: str = "generate_image"
    description: str = """
    Generates an image based on a text description using DALL-E 3.
    * Use this when you need a specific image that you cannot find via search.
    * Returns the local file path of the generated image.
    """
    parameters: dict = {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "A detailed description of the image to generate.",
            },
        },
        "required": ["prompt"],
    }

    async def execute(self, prompt: str, **kwargs) -> ToolResult:
        try:
            # Initialize OpenAI client using default LLM config
            llm_config = config.llm['default']
            
            # Ensure we have an API key
            if not llm_config.api_key:
                return ToolResult(error="No API key found in configuration for image generation.")

            client = AsyncOpenAI(
                api_key=llm_config.api_key,
                base_url=llm_config.base_url
            )

            print(f"🎨 Generating image for: '{prompt}'...")
            
            # Call DALL-E 3
            # Note: Some providers might not support 'dall-e-3' or might require different params.
            # We assume standard OpenAI API compatibility.
            response = await client.images.generate(
                model="dall-e-3",
                prompt=prompt,
                size="1024x1024",
                quality="standard",
                n=1,
            )

            image_url = response.data[0].url
            
            # Download the image
            input_dir = "input"
            if not os.path.exists(input_dir):
                os.makedirs(input_dir)
                
            filename = f"gen_{uuid.uuid4().hex[:8]}.png"
            local_path = os.path.join(input_dir, filename)
            
            img_response = requests.get(image_url)
            img_response.raise_for_status()
            
            with open(local_path, 'wb') as f:
                f.write(img_response.content)
                
            print(f"✅ Image generated and saved to: {local_path}")
            return ToolResult(output=local_path)

        except Exception as e:
            return ToolResult(error=f"Failed to generate image: {e}")
