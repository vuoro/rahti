import {
  Context,
  UniformBlock,
  Attribute,
  Elements,
  Instances,
  Command,
  Texture,
  Camera,
} from "./webgl2/webgl2.js";

export const TestGraphics = function (props, canvas) {
  const context = <Context canvas={canvas} debug={true} />;

  const shape = (
    <Attribute
      context={context}
      data={[
        Float32Array.of(0, 0),
        Float32Array.of(1, 0),
        Float32Array.of(1, 1),
        Float32Array.of(0, 1),
      ]}
    />
  );
  const shared = <UniformBlock context={context} uniforms={{ time: 0, lightColor: [0, 0, 0] }} />;
  const smallTexture = (
    <Texture
      context={context}
      pixels={new Uint8Array(64 * 64 * 4).fill(128)}
      anisotropicFiltering={16}
    />
  );
  const [cameraController, camera] = <Camera context={context} fov={90} />;

  const triangleElements = <Elements context={context} data={Int16Array.of(0, 1, 2)} />;
  const quadElements = <Elements context={context} data={Int16Array.of(0, 1, 2, 2, 3, 0)} />;

  const QuadInstance = (
    <Instances
      context={context}
      attributes={{
        color: [1, 1, 1],
        offset: [0, 0],
      }}
    />
  );

  const drawTriangle = (
    <Command
      context={context}
      attributes={{ shape }}
      textures={{ smallTexture }}
      elements={triangleElements}
      vertex={`
      out vec2 textureCoordinates;
      void main () {
        textureCoordinates = shape;
        gl_Position = vec4(shape, 0.0, 1.0);
      }
    `}
      fragment={`
      in vec2 textureCoordinates;
      out vec4 fragment;

      float fDistance(float x) {
        return length(vec2(dFdx(x), dFdy(x)));
      }

      float aLine(float threshold, float value, float thickness) {
        return clamp(thickness - abs(threshold - value) / fDistance(value), 0.0, 1.0);
      }

      void main () {
        fragment = vec4(texture(smallTexture, textureCoordinates).rgb, 1.0);
        fragment.rgb *= 1.0 - aLine(0.5, length(textureCoordinates), 1.0);
      }
    `}
    />
  );

  const drawQuads = (
    <Command
      context={context}
      attributes={{ shape }}
      uniformBlocks={{ camera }}
      elements={quadElements}
      instances={QuadInstance}
      vertex={`
      out vec3 colorOut;

      void main () {
        colorOut = color;
        gl_Position = projectionView * vec4(shape + offset, -offset.x, 1.0);
      }
    `}
      fragment={`
      in vec3 colorOut;
      out vec4 fragment;

      void main () {
        fragment = vec4(colorOut, 1.0);
      }
    `}
    />
  );

  return {
    frame: context.frame,
    resize: context.resize,
    drawTriangle,
    drawQuads,
    clear: context.clear,
    QuadInstance,
    shared,
    cameraController,
    smallTexture,
  };
};
